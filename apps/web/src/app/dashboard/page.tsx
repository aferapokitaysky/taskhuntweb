'use client';

import Link from 'next/link';
import { BoostIcon } from '@/components/icons/BoostIcon';
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
  });
  const [bidForm, setBidForm] = useState({ amount: '', deliveryDays: '3', message: '' });
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
  const [withdrawForm, setWithdrawForm] = useState({ amount: '', payoutAddress: '' });
  const [withdrawResult, setWithdrawResult] = useState<{ fee: string | number; netAmount: string | number } | null>(
    null,
  );
  const [withdrawing, setWithdrawing] = useState(false);

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
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить dashboard'))
      .finally(() => setLoading(false));
  }, []);

  const isClient = me?.roles.includes('CLIENT') ?? false;
  const isFreelancer = me?.roles.includes('FREELANCER') ?? false;
  const flatCategories = categories.flatMap((category) => [category, ...(category.children ?? [])]);

  async function refreshOrders() {
    const nextOrders = await api<Order[]>('/orders');
    setOrders(nextOrders);
  }

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
        }),
      });
      setOrderForm((current) => ({ ...current, title: '', description: '', budgetMin: '', budgetMax: '', deadline: '' }));
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
    setError(null);
    setWithdrawing(true);
    try {
      const result = await api<{ fee: number; netAmount: number }>('/wallet/withdraw', {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(withdrawForm.amount),
          payoutAddress: withdrawForm.payoutAddress,
        }),
      });
      setWithdrawResult(result);
      setWithdrawForm({ amount: '', payoutAddress: '' });
      const balance = await api<WalletBalance>('/wallet/balance');
      setWallet(balance);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось запросить вывод');
    } finally {
      setWithdrawing(false);
    }
  }

  if (loading) {
    return <main className="mx-auto max-w-6xl px-4 py-10 text-slate-500">Загружаем dashboard...</main>;
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">TaskHunt</p>
          <h1 className="text-3xl font-bold">Dashboard</h1>
        </div>
        <div className="flex gap-3">
          {me?.isStaff && (
            <Link href="/admin" className="rounded-lg border border-slate-300 px-4 py-2 font-medium hover:bg-white">
              Admin
            </Link>
          )}
          <Link href="/profile" className="rounded-lg border border-slate-300 px-4 py-2 font-medium hover:bg-white">
            Профиль
          </Link>
          <Link href="/support" className="rounded-lg border border-slate-300 px-4 py-2 font-medium hover:bg-white">
            Поддержка
          </Link>
          <Link href="/pricing" className="rounded-lg border border-slate-300 px-4 py-2 font-medium hover:bg-white">
            Тарифы
          </Link>
          <Link href="/referrals" className="rounded-lg border border-slate-300 px-4 py-2 font-medium hover:bg-white">
            Реферальная программа
          </Link>
          <Link href="/" className="rounded-lg border border-slate-300 px-4 py-2 font-medium hover:bg-white">
            На главную
          </Link>
        </div>
      </header>

      {error && <p className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <section className="mb-8 grid gap-3 md:grid-cols-5">
        {wallet &&
          [
            ['Main', wallet.mainBalance],
            ['Escrow', wallet.escrowBalance],
            ['Locked', wallet.lockedBalance],
            ['Withdrawable', wallet.withdrawableBalance],
            ['Pending', wallet.pendingBalance],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase text-slate-500">{label}</p>
              <p className="mt-1 text-lg font-semibold">{money(value, wallet.currency)}</p>
            </div>
          ))}
      </section>

      <section className="mb-8 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Вывод средств</h2>
          <button
            type="button"
            onClick={() => setShowWithdrawForm((v) => !v)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            {showWithdrawForm ? 'Скрыть' : 'Вывести средства'}
          </button>
        </div>

        {showWithdrawForm && (
          <form onSubmit={submitWithdraw} className="mt-4 flex flex-wrap items-end gap-3">
            <input
              required
              type="number"
              min="1"
              placeholder="Сумма, USD"
              value={withdrawForm.amount}
              onChange={(e) => setWithdrawForm((f) => ({ ...f, amount: e.target.value }))}
              className="w-40 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <input
              required
              placeholder="Адрес кошелька для выплаты"
              value={withdrawForm.payoutAddress}
              onChange={(e) => setWithdrawForm((f) => ({ ...f, payoutAddress: e.target.value }))}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={withdrawing}
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
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-xl font-semibold">Заказы</h2>
            <span className="text-sm text-slate-500">{orders.length}</span>
          </div>
          <div className="space-y-3">
            {orders.map((order) => (
              <article key={order.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
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
                    <p className="mt-1 line-clamp-2 text-sm text-slate-600">{order.description}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">{money(order.budgetMin, order.currency)}</p>
                    <p className="text-xs text-slate-500">{order.status}</p>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                  <span className="rounded-full bg-slate-100 px-3 py-1">{order.category?.name ?? 'Категория'}</span>
                  <span className="text-slate-500">Откликов: {order._count?.bids ?? order.bids?.length ?? 0}</span>
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
          </div>
        </section>

        <aside className="space-y-6">
          {isClient && (
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold">Создать заказ</h2>
              <form onSubmit={createOrder} className="space-y-3">
                <select
                  value={orderForm.categoryId}
                  onChange={(e) => setOrderForm({ ...orderForm, categoryId: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
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
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
                <textarea
                  required
                  minLength={20}
                  placeholder="Описание задачи"
                  value={orderForm.description}
                  onChange={(e) => setOrderForm({ ...orderForm, description: e.target.value })}
                  className="min-h-28 w-full rounded-lg border border-slate-300 px-3 py-2"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    required
                    type="number"
                    min="1"
                    placeholder="Бюджет от"
                    value={orderForm.budgetMin}
                    onChange={(e) => setOrderForm({ ...orderForm, budgetMin: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                  <input
                    type="number"
                    min="1"
                    placeholder="До"
                    value={orderForm.budgetMax}
                    onChange={(e) => setOrderForm({ ...orderForm, budgetMax: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <input
                  type="date"
                  value={orderForm.deadline}
                  onChange={(e) => setOrderForm({ ...orderForm, deadline: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
                <button type="submit" className="w-full rounded-lg bg-brand px-4 py-3 font-medium text-white">
                  Опубликовать
                </button>
              </form>
            </section>
          )}

          {selectedOrder && (
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-1 text-lg font-semibold">Отклик</h2>
              <p className="mb-4 text-sm text-slate-500">{selectedOrder.title}</p>
              <form onSubmit={submitBid} className="space-y-3">
                <input
                  required
                  type="number"
                  min="1"
                  placeholder="Сумма, USD"
                  value={bidForm.amount}
                  onChange={(e) => setBidForm({ ...bidForm, amount: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
                <input
                  required
                  type="number"
                  min="1"
                  placeholder="Дней на выполнение"
                  value={bidForm.deliveryDays}
                  onChange={(e) => setBidForm({ ...bidForm, deliveryDays: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                />
                <textarea
                  required
                  placeholder="Сообщение заказчику"
                  value={bidForm.message}
                  onChange={(e) => setBidForm({ ...bidForm, message: e.target.value })}
                  className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2"
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
