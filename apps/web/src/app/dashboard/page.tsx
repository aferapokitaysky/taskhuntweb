'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { BoostIcon } from '@/components/icons/BoostIcon';
import { BellIcon } from '@/components/icons/BellIcon';
import { AppHeader } from '@/components/AppHeader';
import { ErrorNotice } from '@/components/ErrorNotice';
import { EmptyState } from '@/components/EmptyState';
import type { WithdrawTarget } from '@/components/PayoutAddressBook';
import { BuildIcon } from '@/components/icons/illustrated/BuildIcon';
import { WalletIcon } from '@/components/icons/WalletIcon';
import { ShieldIcon } from '@/components/icons/ShieldIcon';
import { PadlockIcon } from '@/components/icons/PadlockIcon';
import { WithdrawIcon } from '@/components/icons/WithdrawIcon';
import { ClockIcon } from '@/components/icons/ClockIcon';
import { Mascot } from '@/components/Mascot';
import { TargetIcon } from '@/components/icons/TargetIcon';
import { DownloadIcon } from '@/components/icons/DownloadIcon';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import { Skeleton, OrderCardSkeleton } from '@/components/Skeleton';
import { NextLevelWidget } from '@/components/NextLevelWidget';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, API_URL, downloadFile } from '@/lib/api';
import type { BidTemplate, Category, LedgerEntryItem, Order, PaginatedOrders, PreviousFreelancer, SavedPayoutAddress, SavedSearch, User, WalletBalance } from '@/lib/types';
import { money } from '@/lib/types';

// Тянет @web3icons/react (лого сетей) — тяжёлый пакет, нужен только когда
// реально открыта форма вывода, поэтому грузим его отдельным чанком,
// а не в основной бандл дашборда.
const PayoutAddressBook = dynamic(
  () => import('@/components/PayoutAddressBook').then((m) => m.PayoutAddressBook),
  { ssr: false, loading: () => <p className="text-sm text-stone-400">Загружаем сети…</p> },
);

const TRANSACTION_TYPE_LABELS: Record<LedgerEntryItem['type'], string> = {
  DEPOSIT: 'Пополнение',
  WITHDRAWAL: 'Вывод средств',
  ESCROW_LOCK: 'Заморозка в эскроу',
  ESCROW_RELEASE: 'Выплата из эскроу',
  REFUND: 'Возврат',
  COMMISSION: 'Комиссия',
  BONUS: 'Бонус',
  REFERRAL: 'Реферальное вознаграждение',
  PROMO: 'Продвижение',
  CHARGEBACK: 'Чарджбэк',
};

export default function DashboardPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-7xl px-4 py-10 text-stone-500">Загружаем dashboard...</main>}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const searchParams = useSearchParams();
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
  const [showAutoWithdraw, setShowAutoWithdraw] = useState(false);
  const [autoWithdrawThreshold, setAutoWithdrawThreshold] = useState('');
  const [autoWithdrawAddressId, setAutoWithdrawAddressId] = useState('');
  const [savedAddresses, setSavedAddresses] = useState<SavedPayoutAddress[]>([]);
  const [autoWithdrawSaving, setAutoWithdrawSaving] = useState(false);
  const [autoWithdrawSaved, setAutoWithdrawSaved] = useState(false);
  const [withdrawResult, setWithdrawResult] = useState<{ fee: string | number; netAmount: string | number } | null>(
    null,
  );
  const [withdrawing, setWithdrawing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyItems, setHistoryItems] = useState<LedgerEntryItem[]>([]);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [orderSearch, setOrderSearch] = useState('');
  const [savedOrderIds, setSavedOrderIds] = useState<Set<string>>(new Set());
  const [invitedOrderIds, setInvitedOrderIds] = useState<Set<string>>(new Set());
  const [savedOrders, setSavedOrders] = useState<Order[]>([]);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [filterCategoryId, setFilterCategoryId] = useState(searchParams.get('categoryId') ?? '');
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [filterTagInput, setFilterTagInput] = useState('');
  const [filterMinBudget, setFilterMinBudget] = useState('');
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [bidTemplates, setBidTemplates] = useState<BidTemplate[]>([]);
  const [previousFreelancers, setPreviousFreelancers] = useState<PreviousFreelancer[]>([]);
  const [savingSearch, setSavingSearch] = useState(false);
  const [savedSearchError, setSavedSearchError] = useState<string | null>(null);

  useEffect(() => {
    // Если пришли по ссылке с /categories с уже готовым ?categoryId= —
    // применяем фильтр сразу в первом запросе, а не ждём отдельного
    // дебаунса (тот на первом рендере намеренно не стреляет, см. ниже).
    const initialOrdersUrl = filterCategoryId ? `/orders?categoryId=${filterCategoryId}` : '/orders';
    Promise.all([api<User>('/users/me'), api<WalletBalance>('/wallet/balance'), api<PaginatedOrders>(initialOrdersUrl), api<Category[]>('/categories')])
      .then(([user, balance, orderPage, categoryList]) => {
        setMe(user);
        setWallet(balance);
        if (balance.autoWithdrawThreshold) {
          setAutoWithdrawThreshold(balance.autoWithdrawThreshold);
          setAutoWithdrawAddressId(balance.autoWithdrawAddressId ?? '');
        }
        setOrders(orderPage.items);
        setCategories(categoryList);
        const firstCategory = categoryList.flatMap((category) => [category, ...(category.children ?? [])])[0];
        setOrderForm((current) => ({ ...current, categoryId: firstCategory?.id ?? '' }));
      })
      .catch(() => undefined) // сбой начальной загрузки — просто пустой dashboard с иллюстрациями, без тревожного баннера
      .finally(() => setLoading(false));

    api<Order[]>('/orders/saved/mine')
      .then((list) => {
        setSavedOrders(list);
        setSavedOrderIds(new Set(list.map((o) => o.id)));
      })
      .catch(() => undefined);

    api<SavedSearch[]>('/saved-searches')
      .then(setSavedSearches)
      .catch(() => undefined);

    api<{ orderId: string }[]>('/orders/invites/mine')
      .then((invites) => setInvitedOrderIds(new Set(invites.map((i) => i.orderId))))
      .catch(() => undefined);

    api<BidTemplate[]>('/users/me/bid-templates')
      .then(setBidTemplates)
      .catch(() => undefined);

    api<SavedPayoutAddress[]>('/wallet/payout-addresses')
      .then(setSavedAddresses)
      .catch(() => undefined);

    api<typeof previousFreelancers>('/users/me/previous-freelancers')
      .then(setPreviousFreelancers)
      .catch(() => undefined);
  }, []);

  async function toggleSaved(order: Order) {
    const isSaved = savedOrderIds.has(order.id);
    setSavedOrderIds((current) => {
      const next = new Set(current);
      if (isSaved) next.delete(order.id);
      else next.add(order.id);
      return next;
    });
    setSavedOrders((current) => (isSaved ? current.filter((o) => o.id !== order.id) : [order, ...current]));
    try {
      if (isSaved) await api(`/orders/${order.id}/favorite`, { method: 'DELETE' });
      else await api(`/orders/${order.id}/favorite`, { method: 'POST' });
    } catch {
      // на ошибке откатываем оптимистичное обновление
      setSavedOrderIds((current) => {
        const next = new Set(current);
        if (isSaved) next.add(order.id);
        else next.delete(order.id);
        return next;
      });
      setSavedOrders((current) => (isSaved ? [order, ...current] : current.filter((o) => o.id !== order.id)));
    }
  }

  const isClient = me?.roles.includes('CLIENT') ?? false;
  const isFreelancer = me?.roles.includes('FREELANCER') ?? false;
  const hasAside = isClient || !!selectedOrder;
  const flatCategories = categories.flatMap((category) => [category, ...(category.children ?? [])]);

  async function refreshOrders() {
    const params = new URLSearchParams();
    if (orderSearch) params.set('search', orderSearch);
    if (filterCategoryId) params.set('categoryId', filterCategoryId);
    if (filterTags.length > 0) params.set('tags', filterTags.join(','));
    if (filterMinBudget) params.set('minBudget', filterMinBudget);
    const nextOrders = await api<PaginatedOrders>(`/orders${params.toString() ? `?${params}` : ''}`);
    setOrders(nextOrders.items);
  }

  // Дебаунс — не дёргаем API на каждое нажатие клавиши/клик по фильтру
  useEffect(() => {
    if (loading) return; // не дублируем самый первый запрос из основного useEffect
    const timeout = setTimeout(() => {
      refreshOrders().catch((err) => setError(err instanceof Error ? err.message : 'Не удалось найти заказы'));
    }, 300);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderSearch, filterCategoryId, filterTags, filterMinBudget]);

  const hasActiveFilter = Boolean(filterCategoryId || filterTags.length > 0 || filterMinBudget);

  async function saveCurrentSearch() {
    const parts: string[] = [];
    const categoryName = flatCategories.find((c) => c.id === filterCategoryId)?.name;
    if (categoryName) parts.push(categoryName);
    if (filterTags.length > 0) parts.push(filterTags.join(', '));
    if (filterMinBudget) parts.push(`от $${filterMinBudget}`);
    const label = parts.join(' · ') || 'Новые заказы';

    setSavingSearch(true);
    setSavedSearchError(null);
    try {
      const created = await api<SavedSearch>('/saved-searches', {
        method: 'POST',
        body: JSON.stringify({
          label,
          categoryId: filterCategoryId || undefined,
          tags: filterTags,
          minBudget: filterMinBudget ? Number(filterMinBudget) : undefined,
        }),
      });
      setSavedSearches((current) => [created, ...current]);
    } catch (err) {
      setSavedSearchError(err instanceof Error ? err.message : 'Не удалось сохранить подписку');
    } finally {
      setSavingSearch(false);
    }
  }

  async function deleteSavedSearch(id: string) {
    setSavedSearches((current) => current.filter((s) => s.id !== id));
    await api(`/saved-searches/${id}`, { method: 'DELETE' }).catch(() => undefined);
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

  async function submitAutoWithdraw(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAutoWithdrawSaving(true);
    setAutoWithdrawSaved(false);
    try {
      await api('/wallet/auto-withdraw', {
        method: 'PATCH',
        body: JSON.stringify({
          threshold: autoWithdrawThreshold ? Number(autoWithdrawThreshold) : null,
          savedAddressId: autoWithdrawAddressId || undefined,
        }),
      });
      setAutoWithdrawSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить настройку автовывода');
    } finally {
      setAutoWithdrawSaving(false);
    }
  }

  async function disableAutoWithdraw() {
    setAutoWithdrawThreshold('');
    setAutoWithdrawAddressId('');
    setAutoWithdrawSaving(true);
    try {
      await api('/wallet/auto-withdraw', { method: 'PATCH', body: JSON.stringify({ threshold: null }) });
    } catch {
      // тихо
    } finally {
      setAutoWithdrawSaving(false);
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

  async function loadHistory(cursor?: string | null) {
    setHistoryLoading(true);
    try {
      const params = cursor ? `?cursor=${cursor}` : '';
      const result = await api<{ items: LedgerEntryItem[]; nextCursor: string | null }>(`/wallet/transactions${params}`);
      setHistoryItems((current) => (cursor ? [...current, ...result.items] : result.items));
      setHistoryCursor(result.nextCursor);
      setHistoryLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить историю операций');
    } finally {
      setHistoryLoading(false);
    }
  }

  function toggleHistory() {
    setShowHistory((v) => !v);
    if (!historyLoaded) loadHistory();
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8">
        <AppHeader />
        <Skeleton className="mb-8 h-9 w-48" />
        <div className="mb-8 grid gap-3 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <OrderCardSkeleton key={i} />
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <AppHeader />
      <h1 className="mb-8 font-serif text-3xl text-stone-900">Dashboard</h1>

      {error && <ErrorNotice message={error} />}

      <section className="mb-8 grid gap-3 md:grid-cols-5">
        {wallet &&
          [
            { label: 'Main', value: wallet.mainBalance, colorClass: 'bg-card-sand', Icon: WalletIcon },
            { label: 'Escrow', value: wallet.escrowBalance, colorClass: 'bg-card-sage', Icon: ShieldIcon },
            { label: 'Locked', value: wallet.lockedBalance, colorClass: 'bg-card-rose', Icon: PadlockIcon },
            { label: 'Withdrawable', value: wallet.withdrawableBalance, colorClass: 'bg-card-lavender', Icon: WithdrawIcon },
            { label: 'Pending', value: wallet.pendingBalance, colorClass: 'bg-cream-200', Icon: ClockIcon },
          ].map(({ label, value, colorClass, Icon }) => (
            <div key={label} className={`rounded-2xl ${colorClass} p-4 transition-transform duration-200 hover:-translate-y-0.5`}>
              <div className="flex items-center gap-1.5 text-stone-600">
                <Icon className="h-4 w-4" />
                <p className="text-xs uppercase">{label}</p>
              </div>
              <p className="mt-1.5 font-serif text-lg text-stone-900">{money(value, wallet.currency)}</p>
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
          <div className="mt-3 flex items-center gap-3 rounded-lg bg-emerald-50 px-3 py-2">
            <Mascot name="thumbsup" size="h-10 w-10" />
            <p className="text-sm text-emerald-700">
              Заявка на вывод принята. Комиссия: {money(withdrawResult.fee, wallet?.currency)}, к выплате:{' '}
              {money(withdrawResult.netAmount, wallet?.currency)}.
            </p>
          </div>
        )}

        <div className="mt-4 border-t border-stone-100 pt-4">
          <button
            type="button"
            onClick={() => setShowAutoWithdraw((v) => !v)}
            className="text-sm font-medium text-stone-500 hover:text-stone-700"
          >
            {showAutoWithdraw ? 'Скрыть автовывод' : 'Настроить автовывод'}
          </button>
          {showAutoWithdraw && (
            <form onSubmit={submitAutoWithdraw} className="mt-3 space-y-3">
              <p className="text-sm text-stone-500">
                Когда доступный баланс превышает порог — заявка на вывод создастся автоматически на выбранный
                сохранённый адрес.
              </p>
              <input
                type="number"
                min="1"
                placeholder="Порог, USD"
                value={autoWithdrawThreshold}
                onChange={(e) => setAutoWithdrawThreshold(e.target.value)}
                className="w-40 rounded-lg border border-stone-300 px-3 py-2 text-sm"
              />
              <select
                value={autoWithdrawAddressId}
                onChange={(e) => setAutoWithdrawAddressId(e.target.value)}
                className="w-full max-w-xs rounded-lg border border-stone-300 px-3 py-2 text-sm"
              >
                <option value="">Выберите адрес…</option>
                {savedAddresses.map((addr) => (
                  <option key={addr.id} value={addr.id}>
                    {addr.label} ({addr.network})
                  </option>
                ))}
              </select>
              {autoWithdrawSaved && <p className="text-sm text-emerald-600">Сохранено.</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={autoWithdrawSaving || !autoWithdrawThreshold || !autoWithdrawAddressId}
                  className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {autoWithdrawSaving ? 'Сохраняем…' : 'Включить'}
                </button>
                {autoWithdrawThreshold && (
                  <button
                    type="button"
                    onClick={disableAutoWithdraw}
                    disabled={autoWithdrawSaving}
                    className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium text-stone-600"
                  >
                    Выключить
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </section>

      <section className="mb-8 rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">История операций</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => downloadFile('/wallet/transactions/export.csv', 'transactions.csv')}
              className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-50"
            >
              Скачать CSV
            </button>
            <button
              type="button"
              onClick={toggleHistory}
              className="rounded-lg border border-stone-300 px-4 py-2 text-sm font-medium hover:bg-stone-50"
            >
              {showHistory ? 'Скрыть' : 'Показать'}
            </button>
          </div>
        </div>

        {showHistory && (
          <div className="mt-4">
            {historyLoading && historyItems.length === 0 && <p className="text-sm text-stone-500">Загружаем…</p>}
            {!historyLoading && historyItems.length === 0 && (
              <p className="text-sm text-stone-400">Операций пока не было.</p>
            )}
            <div className="divide-y divide-stone-100">
              {historyItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3">
                    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 text-stone-400" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      {item.direction === 'CREDIT' ? <path d="M12 19V5M5 12l7-7 7 7" /> : <path d="M12 5v14M5 12l7 7 7-7" />}
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-stone-900">{TRANSACTION_TYPE_LABELS[item.type] ?? item.type}</p>
                      <p className="text-xs text-stone-500">
                        {item.balanceType} · {new Date(item.createdAt).toLocaleString('ru-RU')}
                        {item.description ? ` · ${item.description}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <p className={`font-medium ${item.direction === 'CREDIT' ? 'text-emerald-600' : 'text-stone-700'}`}>
                      {item.direction === 'CREDIT' ? '+' : '−'}
                      {money(item.amount, item.currency)}
                    </p>
                    <button
                      type="button"
                      title="Скачать чек"
                      onClick={() => downloadFile(`/wallet/transactions/${item.id}/receipt.pdf`, `receipt-${item.id}.pdf`)}
                      className="rounded-full p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
                    >
                      <DownloadIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {historyCursor && (
              <button
                type="button"
                onClick={() => loadHistory(historyCursor)}
                disabled={historyLoading}
                className="mt-3 w-full rounded-lg border border-stone-300 py-2 text-sm font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
              >
                {historyLoading ? 'Загружаем…' : 'Показать ещё'}
              </button>
            )}
          </div>
        )}
      </section>

      {isFreelancer && me?.level && (
        <div className="mb-8">
          <NextLevelWidget
            level={me.level}
            completedOrders={me.completedOrders ?? 0}
            successRate={me.profile?.successRate ? Number(me.profile.successRate) : null}
          />
        </div>
      )}

      <div className={`grid gap-6 ${hasAside ? 'lg:grid-cols-[1fr_360px]' : ''}`}>
        <section>
          <div className="mb-3 flex flex-wrap items-center gap-2.5">
            <h2 className="font-serif text-xl text-stone-900">Заказы</h2>
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-brand px-2 text-xs font-semibold text-white">
              {orders.length}
            </span>
            <div className="ml-auto flex items-center gap-1 rounded-full bg-stone-100 p-1 text-sm">
              <button
                type="button"
                onClick={() => setShowSavedOnly(false)}
                className={`rounded-full px-3 py-1 font-medium transition ${
                  !showSavedOnly ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                Все
              </button>
              <button
                type="button"
                onClick={() => setShowSavedOnly(true)}
                className={`rounded-full px-3 py-1 font-medium transition ${
                  showSavedOnly ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-500 hover:text-stone-700'
                }`}
              >
                Избранное {savedOrders.length > 0 && `(${savedOrders.length})`}
              </button>
            </div>
          </div>
          {!showSavedOnly && (
            <>
              <input
                placeholder="Поиск по названию или описанию"
                value={orderSearch}
                onChange={(e) => setOrderSearch(e.target.value)}
                className="mb-3 w-full rounded-lg border border-stone-300 px-4 py-2 text-sm"
              />
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <select
                  value={filterCategoryId}
                  onChange={(e) => setFilterCategoryId(e.target.value)}
                  className="rounded-lg border border-stone-300 px-3 py-2 text-sm"
                >
                  <option value="">Все категории</option>
                  {flatCategories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <input
                  placeholder="Тэги через Enter"
                  value={filterTagInput}
                  onChange={(e) => setFilterTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' || !filterTagInput.trim()) return;
                    e.preventDefault();
                    const tag = filterTagInput.trim();
                    if (!filterTags.includes(tag)) setFilterTags((current) => [...current, tag]);
                    setFilterTagInput('');
                  }}
                  className="w-40 rounded-lg border border-stone-300 px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  min="0"
                  placeholder="Бюджет от"
                  value={filterMinBudget}
                  onChange={(e) => setFilterMinBudget(e.target.value)}
                  className="w-28 rounded-lg border border-stone-300 px-3 py-2 text-sm"
                />
                {isFreelancer && (
                  <button
                    type="button"
                    onClick={saveCurrentSearch}
                    disabled={!hasActiveFilter || savingSearch || savedSearches.length >= 5}
                    title={
                      savedSearches.length >= 5
                        ? 'Можно сохранить не больше 5 подписок'
                        : 'Получать уведомление о новых заказах по этому фильтру'
                    }
                    className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-stone-300 px-3 py-1.5 text-sm font-medium text-stone-600 transition hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-stone-300 disabled:hover:text-stone-600"
                  >
                    <BellIcon className="h-4 w-4" />
                    Уведомлять об этом фильтре
                  </button>
                )}
              </div>
              {filterTags.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {filterTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setFilterTags((current) => current.filter((t) => t !== tag))}
                      className="rounded-full bg-card-sand px-2.5 py-1 text-xs font-medium text-stone-700 hover:line-through"
                    >
                      {tag} ×
                    </button>
                  ))}
                </div>
              )}
              {savedSearchError && <p className="mb-3 text-xs text-red-600">{savedSearchError}</p>}
              {savedSearches.length > 0 && (
                <div className="mb-4 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-stone-400">Подписки:</span>
                  {savedSearches.map((s) => (
                    <span
                      key={s.id}
                      className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand"
                    >
                      <BellIcon className="h-3.5 w-3.5" />
                      {s.label}
                      <button type="button" onClick={() => deleteSavedSearch(s.id)} className="hover:text-brand-dark">
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
          <div className="space-y-3">
            {(showSavedOnly ? savedOrders : orders).map((order) => (
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
                  <div className="flex items-start gap-2">
                    <div className="text-right">
                      <p className="font-semibold">{money(order.budgetMin, order.currency)}</p>
                      <OrderStatusBadge status={order.status} className="mt-1" />
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleSaved(order)}
                      title={savedOrderIds.has(order.id) ? 'Убрать из избранного' : 'В избранное'}
                      className="shrink-0 rounded-full p-1 text-stone-300 transition hover:scale-110 hover:text-amber-500"
                    >
                      <svg
                        viewBox="0 0 20 20"
                        className={`h-5 w-5 ${savedOrderIds.has(order.id) ? 'fill-amber-400 text-amber-500' : 'fill-none text-stone-300'}`}
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <path
                          d="M10 3l2.2 4.46 4.92.72-3.56 3.47.84 4.9L10 14.14l-4.4 2.31.84-4.9-3.56-3.47 4.92-.72L10 3z"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
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
                  {invitedOrderIds.has(order.id) && (
                    <span className="flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-medium text-brand">
                      <TargetIcon className="h-3.5 w-3.5" />
                      Вас пригласили
                    </span>
                  )}
                  {isFreelancer && order.status === 'OPEN' && order.clientId !== me?.id && (
                    <button
                      type="button"
                      onClick={() => setSelectedOrder(order)}
                      className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-brand-dark hover:shadow-md active:translate-y-0"
                    >
                      Откликнуться
                      <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="none" aria-hidden="true">
                        <path d="M4 10h12M11 5l5 5-5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  )}
                </div>
              </article>
            ))}
            {showSavedOnly && savedOrders.length === 0 && (
              <EmptyState
                icon={<BuildIcon />}
                title="В избранном пока пусто"
                description="Нажмите на звёздочку у заказа, чтобы вернуться к нему позже."
              />
            )}
            {!showSavedOnly && orders.length === 0 && (
              <EmptyState
                icon={<BuildIcon />}
                title="Заказов пока нет"
                description={isClient ? 'Разместите первый заказ справа — отклики начнут приходить сразу.' : 'Загляните позже или сбросьте поиск.'}
              />
            )}
          </div>
        </section>

        {hasAside && (
        <aside className="space-y-6">
          {isClient && previousFreelancers.length > 0 && (
            <section className="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-lg font-semibold">Нанимали раньше</h2>
              <div className="space-y-2">
                {previousFreelancers.map((f) => (
                  <Link
                    key={f.id}
                    href={`/freelancers/${f.id}`}
                    className="flex items-center gap-3 rounded-lg p-2 text-sm transition hover:bg-stone-50"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-card-sand font-serif text-sm text-stone-900">
                      {f.profile?.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`${API_URL}${f.profile.avatarUrl}`} alt="" className="h-full w-full object-cover" />
                      ) : (
                        f.profile?.displayName?.charAt(0).toUpperCase() ?? '?'
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-stone-900">{f.profile?.displayName ?? 'Фрилансер'}</span>
                      <span className="block text-xs text-stone-500">
                        {f.hireCount} {f.hireCount === 1 ? 'заказ' : 'заказа'}
                        {f.myAvgRating !== null && ` · рейтинг ${f.myAvgRating}`}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}

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
                {bidTemplates.length > 0 && (
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const template = bidTemplates.find((t) => t.id === e.target.value);
                      if (!template) return;
                      setBidForm((f) => ({
                        ...f,
                        message: template.message,
                        deliveryDays: template.defaultDeliveryDays ? String(template.defaultDeliveryDays) : f.deliveryDays,
                      }));
                      e.target.value = '';
                    }}
                    className="w-full rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-600"
                  >
                    <option value="">Вставить шаблон…</option>
                    {bidTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name}
                      </option>
                    ))}
                  </select>
                )}
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
        )}
      </div>
    </main>
  );
}
