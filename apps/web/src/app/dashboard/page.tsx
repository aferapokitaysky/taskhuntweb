'use client';

import Link from 'next/link';
import { BoostIcon } from '@/components/icons/BoostIcon';
import { AppHeader } from '@/components/AppHeader';
import { ErrorNotice } from '@/components/ErrorNotice';
import { EmptyState } from '@/components/EmptyState';
import { PayoutAddressBook, type WithdrawTarget } from '@/components/PayoutAddressBook';
import { BuildIcon } from '@/components/icons/illustrated/BuildIcon';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Category, Order, User, WalletBalance } from '@/lib/types';
import { money } from '@/lib/types';

export default function DashboardPage() {
  const [me, setMe] = useState<User | null>(null);
  const [wallet, setWallet] = useState<WalletBalance | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [orderForm, setOrderForm] = useState({
    categoryId: '',
    title: '',
    description: '',
    budgetMin: '',
    budgetMax: '',
    deadline: '',
    tags: [] as string[],
  });
  const [tagInput, setTagInput] = useState('');
  const [bidForm, setBidForm] = useState({ amount: '', deliveryDays: '3', message: '' });
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [withdrawTarget, setWithdrawTarget] = useState<WithdrawTarget | null>(null);
  const [withdrawResult, setWithdrawResult] = useState<{ fee: string | number; netAmount: string | number } | null>(
    null,
  );
  const [withdrawing, setWithdrawing] = useState(false);
  const [orderSearch, setOrderSearch] = useState('');

  useEffect(() => {
    Promise.all([api<User>('/users/me'), api<WalletBalance>('/wallet/balance'), api<Order[]>('/orders'), api<Category[]>('/categories')])
      .then(([user, balance, orderList, categoryList]) => {
        setMe(user);
        setWallet(balance);
        setOrders(orderList);
        setCategories(categoryList);
        const firstCategory = categoryList.flatMap((category) => [category, ...(category.children ?? [])])[0];
        setOrderForm((current) => ({ ...current, categoryId: firstCategory?.id ?? '' }));
      })
      .catch(() => undefined) // сбой начальной загрузки — просто пустой dashboard с иллюстрациями, без тревожного баннера
      .finally(() => setLoading(false));
  }, []);

  const isClient = me?.roles.includes('CLIENT') ?? false;
  const isFreelancer = me?.roles.includes('FREELANCER') ?? false;
  const flatCategories = categories.flatMap((category) => [category, ...(category.children ?? [])]);

  async function refreshOrders(search?: string) {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    const nextOrders = await api<Order[]>(`/orders${params.toString() ? `?${params}` : ''}`);
    setOrders(nextOrders);
  }

  // Дебаунс поиска — не дёргаем API на каждое нажатие клавиши
  useEffect(() => {
    if (loading) return; // не дублируем самый первый запрос из основного useEffect
    const timeout = setTimeout(() => {
      refreshOrders(orderSearch).catch((err) => setError(err instanceof Error ? err.message : 'Не удалось найти заказы'));
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderSearch]);

  async function createOrder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    try {
      await api<Order>('/orders', {
        method: 'POST',
        body: JSON.stringify({
          categoryId: orderForm.categoryId,
          title: orderForm.title,
          description: orderForm.description,
          budgetMin: Number(orderForm.budgetMin),
          budgetMax: orderForm.budgetMax ? Number(orderForm.budgetMax) : undefined,
          deadline: orderForm.deadline || undefined,
          tags: orderForm.tags,
        }),
      });
      setOrderForm((current) => ({ ...current, title: '', description: '', budgetMin: '', budgetMax: '', deadline: '', tags: [] }));
      setTagInput('');
      await refreshOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать заказ');
    }
  }

  async function submitBid(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!selectedOrder) return;
    setError(null);
    try {
      await api(`/orders/${selectedOrder.id}/bids`, {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(bidForm.amount),
          deliveryDays: Number(bidForm.deliveryDays),
          message: bidForm.message,
        }),
      });
      setBidForm({ amount: '', deliveryDays: '3', message: '' });
      setSelectedOrder(null);
      await refreshOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить отклик');
    }
  }

  async function submitWithdraw(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!withdrawTarget) return;
    setError(null);
    setWithdrawing(true);
    try {
      const body =
        withdrawTarget.mode === 'saved'
          ? { amount: Number(withdrawAmount), savedAddressId: withdrawTarget.savedAddressId }
          : {
              amount: Number(withdrawAmount),
              payoutAddress: withdrawTarget.address,
              network: withdrawTarget.network,
              saveAddress: withdrawTarget.saveAddress,
              label: withdrawTarget.label || undefined,
            };
      const result = await api<{ fee: number; netAmount: number }>('/wallet/withdraw', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setWithdrawResult(result);
      setWithdrawAmount('');
      const balance = await api<WalletBalance>('/wallet/balance');
      setWallet(balance);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось запросить вывод');
    } finally {
      setWithdrawing(false);
    }
  }

  if (loading) {
    return <main className="mx-auto max-w-7xl px-4 py-10 text-stone-500">Загружаем dashboard...</main>;
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <AppHeader />
      <h1 className="mb-8 font-serif text-3xl text-stone-900">Dashboard</h1>

      {error && <ErrorNotice message={error} />}

      <section className="mb-8 grid gap-3 md:grid-cols-5">
        {wallet &&
          (
            [
              ['Main', wallet.mainBalance, 'bg-card-sand'],
              ['Escrow', wallet.escrowBalance, 'bg-card-sage'],
              ['Locked', wallet.lockedBalance, 'bg-card-rose'],
              ['Withdrawable', wallet.withdrawableBalance, 'bg-card-lavender'],
              ['Pending', wallet.pendingBalance, 'bg-cream-200'],
            ] as const
          ).map(([label, value, colorClass]) => (
            <div key={label} className={`rounded-2xl ${colorClass} p-4`}>
              <p className="text-xs uppercase text-stone-600">{label}</p>
              <p className="mt-1 font-serif text-lg text-stone-900">{money(value, wallet.currency)}</p>
            </div>
          ))}
      </section>

      <section className="mb-8 rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Вывод средств</h2>
          <button
            type="button"
            onClick={() => setShowWithdrawForm((v) => !v)}
            className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-50"
          >
            {showWithdrawForm ? 'Скрыть' : 'Вывести средства'}
          </button>
        </div>

        {showWithdrawForm && (
          <form onSubmit={submitWithdraw} className="mt-4 space-y-4">
            <input
              required
              type="number"
              min="1"
              placeholder="Сумма, USD"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              className="w-40 rounded-lg border border-stone-300 px-3 py-2 text-sm"
            />
            <PayoutAddressBook onChange={setWithdrawTarget} />
            <button
              type="submit"
              disabled={withdrawing || !withdrawTarget || !withdrawAmount}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {withdrawing ? 'Отправляем…' : 'Запросить вывод'}
            </button>
          </form>
        )}

        {withdrawResult && (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Заявка на вывод принята. Комиссия: {money(withdrawResult.fee, wallet?.currency)}, к выплате:{' '}
            {money(withdrawResult.netAmount, wallet?.currency)}.
          </p>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section>
          <div className="mb-3 flex items-center gap-2.5">
            <h2 className="font-serif text-xl text-stone-900">Заказы</h2>
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-brand px-2 text-xs font-semibold text-white">
              {orders.length}
            </span>
          </div>
          <input
            placeholder="Поиск по названию или описанию"
            value={orderSearch}
            onChange={(e) => setOrderSearch(e.target.value)}
            className="mb-4 w-full rounded-lg border border-stone-300 px-4 py-2 text-sm"
          />
          <div className="space-y-3">
            {orders.map((order) => (
              <article
                key={order.id}
                className="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link href={`/orders/${order.id}`} className="text-lg font-semibold hover:text-brand">
                        {order.title}
                      </Link>
                      {order.isPromoted && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                          <BoostIcon className="h-3 w-3" />
                          Продвигается
                        </span>
                      )}
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-stone-600">{order.description}</p>
                    {order.tags && order.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {order.tags.map((tag) => (
                          <span key={tag} className="rounded-full bg-card-sand px-2 py-0.5 text-xs text-stone-700">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{money(order.budgetMin, order.currency)}</p>
                    <p className="text-xs text-stone-500">{order.status}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                  <span className="rounded-full bg-stone-100 px-3 py-1">{order.category?.name ?? 'Категория'}</span>
                  <span className="text-stone-500">Откликов: {order._count?.bids ?? order.bids?.length ?? 0}</span>
                  {order.acceptedBidId && (
                    <Link href={`/orders/${order.id}`} className="font-medium text-brand hover:text-brand-dark">
                      Открыть чат
                    </Link>
                  )}
                  {isFreelancer && order.status === 'OPEN' && order.clientId !== me?.id && (
                    <button
                      type="button"
                      onClick={() => setSelectedOrder(order)}
                      className="font-medium text-brand hover:text-brand-dark"
                    >
                      Откликнуться
                    </button>
                  )}
                </div>
              </article>
            ))}
            {orders.length === 0 && (
              <EmptyState
                icon={<BuildIcon />}
                title="Заказов пока нет"
                description={isClient ? 'Разместите первый заказ справа — отклики начнут приходить сразу.' : 'Загляните позже или сбросьте поиск.'}
              />
            )}
          </div>
        </section>

        <aside className="space-y-6">
          {isClient && (
            <section className="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">Создать заказ</h2>
              <form onSubmit={createOrder} className="space-y-3">
                <select
                  value={orderForm.categoryId}
                  onChange={(e) => setOrderForm({ ...orderForm, categoryId: e.target.value })}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2"
                >
                  {flatCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <input
                  required
                  minLength={5}
                  placeholder="Название"
                  value={orderForm.title}
                  onChange={(e) => setOrderForm({ ...orderForm, title: e.target.value })}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2"
                />
                <textarea
                  required
                  minLength={20}
                  placeholder="Описание задачи"
                  value={orderForm.description}
                  onChange={(e) => setOrderForm({ ...orderForm, description: e.target.value })}
                  className="min-h-28 w-full rounded-lg border border-stone-300 px-3 py-2"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    required
                    type="number"
                    min="1"
                    placeholder="Бюджет от"
                    value={orderForm.budgetMin}
                    onChange={(e) => setOrderForm({ ...orderForm, budgetMin: e.target.value })}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2"
                  />
                  <input
                    type="number"
                    min="1"
                    placeholder="До"
                    value={orderForm.budgetMax}
                    onChange={(e) => setOrderForm({ ...orderForm, budgetMax: e.target.value })}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2"
                  />
                </div>
                <input
                  type="date"
                  value={orderForm.deadline}
                  onChange={(e) => setOrderForm({ ...orderForm, deadline: e.target.value })}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2"
                />
                <div>
                  <input
                    placeholder="Тэги/стек — Enter добавляет (React, Node.js…)"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' || !tagInput.trim()) return;
                      e.preventDefault();
                      const tag = tagInput.trim();
                      if (!orderForm.tags.includes(tag)) {
                        setOrderForm((f) => ({ ...f, tags: [...f.tags, tag] }));
                      }
                      setTagInput('');
                    }}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2"
                  />
                  {orderForm.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {orderForm.tags.map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setOrderForm((f) => ({ ...f, tags: f.tags.filter((t) => t !== tag) }))}
                          className="rounded-full bg-card-sand px-2.5 py-1 text-xs font-medium text-stone-700 hover:line-through"
                        >
                          {tag} ×
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button type="submit" className="w-full rounded-lg bg-brand px-4 py-3 font-medium text-white">
                  Опубликовать
                </button>
              </form>
            </section>
          )}

          {selectedOrder && (
            <section className="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
              <h2 className="mb-1 text-lg font-semibold">Отклик</h2>
              <p className="mb-4 text-sm text-stone-500">{selectedOrder.title}</p>
              <form onSubmit={submitBid} className="space-y-3">
                <input
                  required
                  type="number"
                  min="1"
                  placeholder="Сумма, USD"
                  value={bidForm.amount}
                  onChange={(e) => setBidForm({ ...bidForm, amount: e.target.value })}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2"
                />
                <input
                  required
                  type="number"
                  min="1"
                  placeholder="Дней на выполнение"
                  value={bidForm.deliveryDays}
                  onChange={(e) => setBidForm({ ...bidForm, deliveryDays: e.target.value })}
                  className="w-full rounded-lg border border-stone-300 px-3 py-2"
                />
                <textarea
                  required
                  placeholder="Сообщение заказчику"
                  value={bidForm.message}
                  onChange={(e) => setBidForm({ ...bidForm, message: e.target.value })}
                  className="min-h-24 w-full rounded-lg border border-stone-300 px-3 py-2"
                />
                <button type="submit" className="w-full rounded-lg bg-brand px-4 py-3 font-medium text-white">
                  Отправить отклик
                </button>
              </form>
            </section>
          )}
        </aside>
      </div>
    </main>
  );
}
