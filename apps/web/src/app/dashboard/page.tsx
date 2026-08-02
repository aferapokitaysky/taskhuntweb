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
import { LockedFundsIcon } from '@/components/icons/illustrated/LockedFundsIcon';
import { BalanceMainIcon } from '@/components/icons/illustrated/BalanceMainIcon';
import { BalanceEscrowIcon } from '@/components/icons/illustrated/BalanceEscrowIcon';
import { BalancePendingIcon } from '@/components/icons/illustrated/BalancePendingIcon';
import { FavoriteOrderIcon } from '@/components/icons/illustrated/FavoriteOrderIcon';
import { TransactionDirectionIcon } from '@/components/icons/illustrated/TransactionDirectionIcon';
import { WithdrawIcon } from '@/components/icons/WithdrawIcon';
import { Mascot } from '@/components/Mascot';
import { TargetIcon } from '@/components/icons/TargetIcon';
import { DownloadIcon } from '@/components/icons/DownloadIcon';
import { OrderStatusBadge } from '@/components/OrderStatusBadge';
import { TagAutocomplete } from '@/components/TagAutocomplete';
import { Skeleton, OrderCardSkeleton } from '@/components/Skeleton';
import { NextLevelWidget } from '@/components/NextLevelWidget';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api, API_URL, downloadFile } from '@/lib/api';
import type { BidTemplate, Category, LedgerEntryItem, MyBid, Order, PaginatedOrders, PreviousFreelancer, SavedPayoutAddress, SavedSearch, Skill, User, WalletBalance, WalletDeposit } from '@/lib/types';
import { PaymentConfirmDetails } from '@/components/PaymentConfirmDetails';
import { money } from '@/lib/types';
import { BID_STATUS_LABELS } from '@/lib/bidStatus';

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

type OrderStatusView = 'all' | 'open' | 'active' | 'review' | 'done';

const ORDER_STATUS_TABS: Array<{ value: OrderStatusView; label: string; statuses: Order['status'][] }> = [
  { value: 'all', label: 'Все', statuses: ['DRAFT', 'OPEN', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED', 'CANCELLED', 'DISPUTED', 'EXPIRED'] },
  { value: 'open', label: 'Открытые', statuses: ['OPEN'] },
  { value: 'active', label: 'В работе', statuses: ['IN_PROGRESS', 'DISPUTED'] },
  { value: 'review', label: 'На проверке', statuses: ['IN_REVIEW'] },
  { value: 'done', label: 'Завершенные', statuses: ['COMPLETED', 'CANCELLED', 'EXPIRED'] },
];

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
  const [recommendedOrders, setRecommendedOrders] = useState<Order[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
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
  const [creatingOrder, setCreatingOrder] = useState(false);
  const [savingOrderDraft, setSavingOrderDraft] = useState(false);
  const [orderFormNotice, setOrderFormNotice] = useState<string | null>(null);
  const [orderDrafts, setOrderDrafts] = useState<Order[]>([]);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [deletingDraftId, setDeletingDraftId] = useState<string | null>(null);
  const [bidForm, setBidForm] = useState({ amount: '', deliveryDays: '', message: '' });
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
  const [showDepositForm, setShowDepositForm] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [depositCreating, setDepositCreating] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [activeDeposit, setActiveDeposit] = useState<WalletDeposit | null>(null);
  const [depositPaid, setDepositPaid] = useState(false);
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
  const [orderStatusView, setOrderStatusView] = useState<OrderStatusView>('all');
  const [filterCategoryId, setFilterCategoryId] = useState(searchParams.get('categoryId') ?? '');
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [filterMinBudget, setFilterMinBudget] = useState('');
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [bidTemplates, setBidTemplates] = useState<BidTemplate[]>([]);
  const [previousFreelancers, setPreviousFreelancers] = useState<PreviousFreelancer[]>([]);
  const [savingSearch, setSavingSearch] = useState(false);
  const [savedSearchError, setSavedSearchError] = useState<string | null>(null);
  // Мои отклики (фрилансер) — статус каждого, без захода в каждый заказ отдельно.
  const [myBids, setMyBids] = useState<MyBid[]>([]);
  // Отклики на мой заказ (заказчик) — разворачиваются inline под карточкой,
  // без перехода на отдельную страницу заказа.
  const [expandedBidsOrderId, setExpandedBidsOrderId] = useState<string | null>(null);
  const [expandedOrderDetail, setExpandedOrderDetail] = useState<Order | null>(null);
  const [expandedBidsLoading, setExpandedBidsLoading] = useState(false);
  const [bidActionLoadingId, setBidActionLoadingId] = useState<string | null>(null);
  const [bidActionError, setBidActionError] = useState<string | null>(null);

  useEffect(() => {
    // Если пришли по ссылке с /categories с уже готовым ?categoryId= —
    // применяем фильтр сразу в первом запросе, а не ждём отдельного
    // дебаунса (тот на первом рендере намеренно не стреляет, см. ниже).
    const initialOrdersUrl = filterCategoryId ? `/orders?categoryId=${filterCategoryId}` : '/orders';
    Promise.all([
      api<User>('/users/me'),
      api<WalletBalance>('/wallet/balance'),
      api<PaginatedOrders>(initialOrdersUrl),
      api<Category[]>('/categories'),
      api<Skill[]>('/skills'),
    ])
      .then(([user, balance, orderPage, categoryList, skillList]) => {
        setMe(user);
        setWallet(balance);
        if (balance.autoWithdrawThreshold) {
          setAutoWithdrawThreshold(balance.autoWithdrawThreshold);
          setAutoWithdrawAddressId(balance.autoWithdrawAddressId ?? '');
        }
        setOrders(orderPage.items);
        setCategories(categoryList);
        setSkills(skillList);
        const firstCategory = categoryList.flatMap((category) => [category, ...(category.children ?? [])])[0];
        setOrderForm((current) => ({ ...current, categoryId: firstCategory?.id ?? '' }));

        if (user.roles.includes('FREELANCER')) {
          api<Order[]>('/orders/saved/mine')
            .then((list) => {
              setSavedOrders(list);
              setSavedOrderIds(new Set(list.map((o) => o.id)));
            })
            .catch(() => undefined);

          api<{ orderId: string }[]>('/orders/invites/mine')
            .then((invites) => setInvitedOrderIds(new Set(invites.map((i) => i.orderId))))
            .catch(() => undefined);

          api<BidTemplate[]>('/users/me/bid-templates')
            .then(setBidTemplates)
            .catch(() => undefined);
        }

        if (user.roles.includes('CLIENT')) {
          refreshDrafts().catch(() => undefined);
          api<typeof previousFreelancers>('/users/me/previous-freelancers')
            .then(setPreviousFreelancers)
            .catch(() => undefined);
        }
      })
      .catch(() => undefined) // сбой начальной загрузки — просто пустой dashboard с иллюстрациями, без тревожного баннера
      .finally(() => setLoading(false));

    api<SavedSearch[]>('/saved-searches')
      .then(setSavedSearches)
      .catch(() => undefined);

    api<SavedPayoutAddress[]>('/wallet/payout-addresses')
      .then(setSavedAddresses)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!me?.roles.includes('FREELANCER')) return;
    api<Order[]>('/matching/orders?limit=3')
      .then(setRecommendedOrders)
      .catch(() => setRecommendedOrders([]));
  }, [me]);

  function refreshMyBids() {
    return api<MyBid[]>('/orders/bids/mine')
      .then(setMyBids)
      .catch(() => undefined);
  }

  useEffect(() => {
    if (!me?.roles.includes('FREELANCER')) return;
    refreshMyBids();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  // Клик по "Разобрать отклики" — вместо перехода на /orders/:id тянем
  // полную карточку заказа (с freelancer/profile на каждом bid) и
  // разворачиваем список прямо тут. Повторный клик по той же карточке
  // сворачивает панель без лишнего запроса.
  async function toggleBidsPanel(orderId: string) {
    setBidActionError(null);
    if (expandedBidsOrderId === orderId) {
      setExpandedBidsOrderId(null);
      setExpandedOrderDetail(null);
      return;
    }
    setExpandedBidsOrderId(orderId);
    setExpandedOrderDetail(null);
    setExpandedBidsLoading(true);
    try {
      const full = await api<Order>(`/orders/${orderId}`);
      setExpandedOrderDetail(full);
    } catch (err) {
      setBidActionError(err instanceof Error ? err.message : 'Не удалось загрузить отклики');
    } finally {
      setExpandedBidsLoading(false);
    }
  }

  async function respondToBid(orderId: string, bidId: string, action: 'accept' | 'reject') {
    setBidActionLoadingId(bidId);
    setBidActionError(null);
    try {
      await api(`/orders/${orderId}/bids/${bidId}/${action}`, { method: 'POST' });
      const full = await api<Order>(`/orders/${orderId}`);
      setExpandedOrderDetail(full);
      await refreshOrders();
    } catch (err) {
      setBidActionError(err instanceof Error ? err.message : 'Не удалось обработать отклик');
    } finally {
      setBidActionLoadingId(null);
    }
  }

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
  // Верхнеуровневая категория для формы заказа выводится ИЗ выбранного
  // categoryId (а не хранится отдельным состоянием) — так работает и для
  // значения по умолчанию, и для загрузки черновика (draft.categoryId может
  // быть как категорией, так и её нишей — см. loadDraftIntoForm).
  const orderFormParentCategory = categories.find(
    (category) => category.id === orderForm.categoryId || (category.children ?? []).some((child) => child.id === orderForm.categoryId),
  );
  const orderFormChecks = [
    { label: 'Категория', done: Boolean(orderForm.categoryId) },
    { label: 'Название 5+ символов', done: orderForm.title.trim().length >= 5 },
    { label: 'Описание 20+ символов', done: orderForm.description.trim().length >= 20 },
    { label: 'Бюджет от 1 $', done: Number(orderForm.budgetMin) > 0 },
    { label: 'Стек или теги', done: orderForm.tags.length > 0 },
  ];
  const orderFormProgress = Math.round((orderFormChecks.filter((item) => item.done).length / orderFormChecks.length) * 100);
  const orderFormReady = orderFormChecks.slice(0, 4).every((item) => item.done);
  const orderFormBudgetPreview =
    Number(orderForm.budgetMin) > 0
      ? orderForm.budgetMax
        ? `${money(orderForm.budgetMin, 'USD')} - ${money(orderForm.budgetMax, 'USD')}`
        : `от ${money(orderForm.budgetMin, 'USD')}`
      : 'Бюджет не указан';

  async function refreshOrders() {
    const params = new URLSearchParams();
    if (orderSearch) params.set('search', orderSearch);
    if (filterCategoryId) params.set('categoryId', filterCategoryId);
    if (filterTags.length > 0) params.set('tags', filterTags.join(','));
    if (filterMinBudget) params.set('minBudget', filterMinBudget);
    const nextOrders = await api<PaginatedOrders>(`/orders${params.toString() ? `?${params}` : ''}`);
    setOrders(nextOrders.items);
  }

  async function refreshDrafts() {
    const drafts = await api<Order[]>('/orders/drafts/mine');
    setOrderDrafts(drafts);
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

  const hasActiveFilter = Boolean(orderSearch || filterCategoryId || filterTags.length > 0 || filterMinBudget);
  const orderPool = showSavedOnly ? savedOrders : orders;
  const visibleOrders = useMemo(() => {
    const tab = ORDER_STATUS_TABS.find((item) => item.value === orderStatusView) ?? ORDER_STATUS_TABS[0];
    if (tab.value === 'all') return orderPool;
    return orderPool.filter((order) => tab.statuses.includes(order.status));
  }, [orderPool, orderStatusView]);
  const orderCounts = useMemo(() => {
    return ORDER_STATUS_TABS.reduce(
      (acc, tab) => ({
        ...acc,
        [tab.value]: tab.value === 'all' ? orderPool.length : orderPool.filter((order) => tab.statuses.includes(order.status)).length,
      }),
      {} as Record<OrderStatusView, number>,
    );
  }, [orderPool]);
  const invitedCount = orderPool.filter((order) => invitedOrderIds.has(order.id)).length;
  const boostedCount = orderPool.filter((order) => order.isPromoted).length;
  const totalBidCount = orderPool.reduce((sum, order) => sum + (order._count?.bids ?? order.bids?.length ?? 0), 0);
  const ownOrderCount = me ? orderPool.filter((order) => order.clientId === me.id).length : 0;
  const availableOrderCount = me ? orderPool.filter((order) => order.status === 'OPEN' && order.clientId !== me.id).length : 0;
  const roleOrderTitle = isClient && !isFreelancer ? 'Мои заказы' : isFreelancer && !isClient ? 'Лента заказов' : 'Заказы и найм';
  const roleOrderDescription =
    isClient && !isFreelancer
      ? 'Следите за своими публикациями, откликами, дедлайнами и переходите в заказ без лишних действий.'
      : isFreelancer && !isClient
        ? 'Отберите подходящие задачи, сохраните важные фильтры и отвечайте на хорошие заказы быстрее конкурентов.'
        : 'В одном месте: ваши публикации как заказчика и открытая лента для работы как исполнителя.';
  const primaryOrderFilterLabel = isClient && !isFreelancer ? 'Мои заказы' : 'Все заказы';
  const withdrawAmountNumber = Number(withdrawAmount);
  const withdrawableNumber = Number(wallet?.withdrawableBalance ?? 0);
  const withdrawAmountEntered = withdrawAmount.trim().length > 0 && Number.isFinite(withdrawAmountNumber);
  const withdrawHasEnoughFunds = withdrawAmountEntered && withdrawAmountNumber > 0 && withdrawAmountNumber <= withdrawableNumber;
  const withdrawAmountTooHigh = withdrawAmountEntered && withdrawAmountNumber > withdrawableNumber;

  function clearOrderFilters() {
    setOrderSearch('');
    setFilterCategoryId('');
    setFilterTags([]);
    setFilterMinBudget('');
    setOrderStatusView('all');
    setShowSavedOnly(false);
  }

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
    setOrderFormNotice(null);
    setCreatingOrder(true);
    try {
      const payload = {
        categoryId: orderForm.categoryId,
        title: orderForm.title,
        description: orderForm.description,
        budgetMin: Number(orderForm.budgetMin),
        budgetMax: orderForm.budgetMax ? Number(orderForm.budgetMax) : undefined,
        deadline: orderForm.deadline || undefined,
        tags: orderForm.tags,
      };
      if (editingDraftId) {
        await api(`/orders/${editingDraftId}`, { method: 'PATCH', body: JSON.stringify(payload) });
        await api(`/orders/drafts/${editingDraftId}/publish`, { method: 'POST' });
      } else {
        await api<Order>('/orders', { method: 'POST', body: JSON.stringify(payload) });
      }
      setOrderForm((current) => ({ ...current, title: '', description: '', budgetMin: '', budgetMax: '', deadline: '', tags: [] }));
      setEditingDraftId(null);
      setOrderFormNotice('Заказ опубликован. Он уже виден фрилансерам в ленте.');
      await refreshOrders();
      await refreshDrafts().catch(() => undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать заказ');
    } finally {
      setCreatingOrder(false);
    }
  }

  async function saveOrderDraft() {
    setError(null);
    setOrderFormNotice(null);
    setSavingOrderDraft(true);
    try {
      const payload = {
        categoryId: orderForm.categoryId,
        title: orderForm.title || undefined,
        description: orderForm.description || undefined,
        budgetMin: orderForm.budgetMin ? Number(orderForm.budgetMin) : undefined,
        budgetMax: orderForm.budgetMax ? Number(orderForm.budgetMax) : undefined,
        deadline: orderForm.deadline || undefined,
        tags: orderForm.tags,
      };
      if (editingDraftId) {
        await api(`/orders/${editingDraftId}`, { method: 'PATCH', body: JSON.stringify(payload) });
      } else {
        const draft = await api<Order>('/orders/drafts', { method: 'POST', body: JSON.stringify(payload) });
        setEditingDraftId(draft.id);
      }
      setOrderFormNotice('Черновик сохранён. Его можно будет продолжить из ваших заказов.');
      await refreshDrafts();
      await refreshOrders();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить черновик');
    } finally {
      setSavingOrderDraft(false);
    }
  }

  function continueDraft(draft: Order) {
    setEditingDraftId(draft.id);
    setOrderForm({
      categoryId: draft.categoryId,
      title: draft.title === 'Черновик заказа' ? '' : draft.title,
      description: draft.description ?? '',
      budgetMin: Number(draft.budgetMin) > 0 ? String(draft.budgetMin) : '',
      budgetMax: draft.budgetMax ? String(draft.budgetMax) : '',
      deadline: draft.deadline ? draft.deadline.slice(0, 10) : '',
      tags: draft.tags ?? [],
    });
    setOrderFormNotice('Черновик загружен в форму. Можно дописать и опубликовать.');
    document.getElementById('create-order')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function deleteDraft(draftId: string) {
    setDeletingDraftId(draftId);
    setError(null);
    try {
      await api(`/orders/drafts/${draftId}`, { method: 'DELETE' });
      setOrderDrafts((current) => current.filter((draft) => draft.id !== draftId));
      if (editingDraftId === draftId) setEditingDraftId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить черновик');
    } finally {
      setDeletingDraftId(null);
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
      setBidForm({ amount: '', deliveryDays: '', message: '' });
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

  async function submitDeposit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const amount = Number(depositAmount);
    if (!Number.isFinite(amount) || amount <= 0) return;
    setDepositError(null);
    setDepositCreating(true);
    try {
      const created = await api<{ id: string; amount: string; currency: string; status: WalletDeposit['status']; payAddress?: string | null; payAmount?: string | null; payCurrency?: string | null }>(
        '/wallet/deposits',
        { method: 'POST', body: JSON.stringify({ amount }) },
      );
      setActiveDeposit({
        depositId: created.id,
        amount: created.amount,
        currency: created.currency,
        status: created.status,
        payAddress: created.payAddress,
        payAmount: created.payAmount,
        payCurrency: created.payCurrency,
        paymentNetwork: created.payCurrency,
      });
      setDepositPaid(false);
    } catch (err) {
      setDepositError(err instanceof Error ? err.message : 'Не удалось создать пополнение');
    } finally {
      setDepositCreating(false);
    }
  }

  // Пока открыт платёжный экран депозита — опрашиваем статус раз в 4с.
  // NOWPayments подтверждает платёж асинхронно (IPN на бэкенд), у фронта
  // нет другого способа узнать "уже пришло?", кроме поллинга.
  useEffect(() => {
    if (!activeDeposit || activeDeposit.status === 'PAID') return;
    const interval = window.setInterval(async () => {
      try {
        const details = await api<WalletDeposit>(`/wallet/deposits/${activeDeposit.depositId}/payment`);
        if (details.status === 'PAID') {
          setActiveDeposit(details);
          setDepositPaid(true);
          const balance = await api<WalletBalance>('/wallet/balance');
          setWallet(balance);
        }
      } catch {
        // тихо — попробуем на следующем тике
      }
    }, 4000);
    return () => window.clearInterval(interval);
  }, [activeDeposit]);

  function closeDepositForm() {
    setShowDepositForm(false);
    setActiveDeposit(null);
    setDepositAmount('');
    setDepositError(null);
    setDepositPaid(false);
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
      <section className="workspace-hero mb-8 p-6 md:p-8">
        <div className="relative grid gap-8 lg:grid-cols-[1fr_380px] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
              {isClient && isFreelancer ? 'Кабинет заказчика и фрилансера' : isClient ? 'Кабинет заказчика' : 'Кабинет фрилансера'}
            </p>
            <h1 className="mt-3 max-w-3xl font-serif text-4xl leading-tight text-stone-950 md:text-6xl">
              {me?.profile?.displayName ? `${me.profile.displayName}, управляем работой спокойно` : 'Ваш рабочий центр TaskHunt'}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-stone-600">
              Баланс, заказы, отклики, избранное, вывод средств и подписки на поиск собраны в одном месте, чтобы путь от
              задачи до оплаты был коротким и понятным.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {isClient && (
                <a href="#create-order" className="primary-action px-5 py-3 text-sm">
                  Создать заказ
                </a>
              )}
              {isFreelancer && (
                <Link href="/search?type=orders" className="secondary-action px-5 py-3 text-sm">
                  Найти заказы
                </Link>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-stone-100 bg-white/65 p-5 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase text-stone-400">Рабочая сводка</p>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <div className="hero-stat p-3">
                <p className="font-serif text-3xl text-stone-950">{orders.length}</p>
                <p className="text-[11px] uppercase text-stone-400">заказов</p>
              </div>
              <div className="hero-stat p-3">
                <p className="font-serif text-3xl text-stone-950">{savedOrders.length}</p>
                <p className="text-[11px] uppercase text-stone-400">избранное</p>
              </div>
              <div className="hero-stat p-3">
                <p className="font-serif text-3xl text-stone-950">{savedSearches.length}</p>
                <p className="text-[11px] uppercase text-stone-400">поиски</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {error && <ErrorNotice message={error} />}

      <section className="premium-panel mb-8 overflow-hidden rounded-[2rem] p-0">
        <div className="grid gap-0 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="finance-panel-lead p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">Финансы</p>
                <h2 className="mt-1 font-serif text-3xl text-stone-950">Баланс и вывод</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-stone-600">
                  Контролируйте доступные деньги, эскроу и заявки на вывод из одного спокойного блока.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Mascot name="payoutWallet" size="h-14 w-14" />
                <button type="button" onClick={() => setShowDepositForm((v) => !v)} className="secondary-action px-5 py-3 text-sm">
                  {showDepositForm ? 'Свернуть пополнение' : 'Пополнить'}
                </button>
                <button type="button" onClick={() => setShowWithdrawForm((v) => !v)} className="primary-action px-5 py-3 text-sm">
                  {showWithdrawForm ? 'Свернуть вывод' : 'Вывести средства'}
                </button>
              </div>
            </div>

            {showDepositForm && (
              <div className="mt-4 rounded-[2rem] border border-stone-100 bg-stone-50/70 p-4">
                {!activeDeposit ? (
                  <form onSubmit={submitDeposit} className="flex flex-wrap items-end gap-3">
                    <label className="field-surface flex min-h-[6.5rem] flex-1 min-w-[10rem] flex-col justify-between p-4">
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-400">Сумма пополнения, USD</span>
                      <input
                        required
                        type="number"
                        min="5"
                        step="0.01"
                        inputMode="decimal"
                        placeholder="100"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        className="mt-2 w-full bg-transparent font-serif text-2xl text-stone-950 outline-none"
                      />
                    </label>
                    <button type="submit" disabled={depositCreating} className="primary-action px-5 py-3 text-sm disabled:opacity-60">
                      {depositCreating ? 'Создаём счёт...' : 'Оплатить криптой'}
                    </button>
                    {depositError && <p className="w-full text-sm text-red-600">{depositError}</p>}
                  </form>
                ) : (
                  <div>
                    {depositPaid ? (
                      <div className="flex items-center gap-3">
                        <Mascot name="successConfetti" size="h-12 w-12" />
                        <p className="text-sm font-medium text-emerald-700">
                          Зачислено {money(activeDeposit.amount, activeDeposit.currency)}. Баланс обновлён.
                        </p>
                      </div>
                    ) : (
                      <PaymentConfirmDetails
                        invoice={activeDeposit}
                        confirmationHint="Отправьте точную сумму на указанный адрес. Как только сеть подтвердит платёж, баланс обновится автоматически — обычно это занимает несколько минут."
                      />
                    )}
                    <button type="button" onClick={closeDepositForm} className="secondary-action mt-4 px-4 py-2 text-sm">
                      {depositPaid ? 'Готово' : 'Отменить'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {wallet && (
              <div className="mt-5 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
                <div className="interactive-card rounded-[2rem] border border-brand/15 bg-white/80 p-5 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">Доступно к выводу</p>
                      <p className="mt-2 font-serif text-4xl leading-none text-stone-950 md:text-5xl">
                        {money(wallet.withdrawableBalance, wallet.currency)}
                      </p>
                    </div>
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-card-lavender text-stone-900">
                      <WithdrawIcon className="h-5 w-5" />
                    </span>
                  </div>
                  <p className="mt-4 max-w-sm text-sm leading-6 text-stone-600">
                    Это сумма, которую можно отправить на сохранённый адрес или новый кошелёк прямо сейчас.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Основной', value: wallet.mainBalance, colorClass: 'bg-card-sand', Icon: BalanceMainIcon },
                    { label: 'В эскроу', value: wallet.escrowBalance, colorClass: 'bg-card-sage', Icon: BalanceEscrowIcon },
                    { label: 'Заблокировано', value: wallet.lockedBalance, colorClass: 'bg-card-rose', Icon: LockedFundsIcon },
                    { label: 'В обработке', value: wallet.pendingBalance, colorClass: 'bg-cream-200', Icon: BalancePendingIcon },
                  ].map(({ label, value, colorClass, Icon }) => (
                    <div key={label} className={`interactive-card min-w-0 rounded-[1.7rem] ${colorClass} p-4 sm:p-5`}>
                      <div className="flex min-w-0 items-center gap-2 text-stone-600">
                        <Icon className="h-6 w-6 shrink-0" />
                        <p className="min-w-0 overflow-visible break-words text-[11px] font-semibold uppercase leading-[1.15] tracking-[0.04em] sm:text-xs">
                          {label}
                        </p>
                      </div>
                      <p className="mt-2 break-words font-serif text-xl leading-tight text-stone-950 sm:text-2xl">
                        {money(value, wallet.currency)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {withdrawResult && (
              <div className="mt-4 flex items-center gap-3 rounded-3xl bg-emerald-50 px-4 py-3">
                <Mascot name="successConfetti" size="h-12 w-12" />
                <p className="text-sm font-medium text-emerald-700">
                  Заявка принята. Комиссия: {money(withdrawResult.fee, wallet?.currency)}, к выплате:{' '}
                  {money(withdrawResult.netAmount, wallet?.currency)}.
                </p>
              </div>
            )}
          </div>

          <div className="finance-panel-side border-t border-stone-100 p-5 md:p-6 xl:border-l xl:border-t-0">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">Операции</p>
                <h3 className="mt-1 font-serif text-2xl text-stone-950">Вывод и история</h3>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => downloadFile('/wallet/transactions/export.csv', 'transactions.csv')} className="secondary-action px-3 py-2 text-sm">
                  CSV
                </button>
                <button type="button" onClick={toggleHistory} className="secondary-action px-3 py-2 text-sm">
                  {showHistory ? 'Скрыть' : 'История'}
                </button>
              </div>
            </div>

            {showWithdrawForm && (
              <form onSubmit={submitWithdraw} className="mt-4 rounded-[2rem] border border-stone-100 bg-stone-50/70 p-4">
                <div className="grid gap-3 md:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                  <label
                    className={`field-surface flex min-h-[8.5rem] flex-col justify-between p-4 transition ${
                      withdrawHasEnoughFunds
                        ? 'border-emerald-300 bg-emerald-50/70'
                        : withdrawAmountTooHigh
                          ? 'border-red-300 bg-red-50/70'
                          : ''
                    }`}
                  >
                    <span className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-400">Сумма вывода</span>
                    <div className="mt-3 flex items-end gap-2">
                      <input
                        required
                        type="number"
                        min="1"
                        inputMode="decimal"
                        placeholder="0"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        className="w-full min-w-0 border-0 bg-transparent p-0 font-serif text-4xl leading-none text-stone-950 shadow-none outline-none ring-0 placeholder:text-stone-300 focus:border-0 focus:ring-0 md:text-5xl"
                      />
                      <span className="pb-1 text-sm font-bold uppercase text-stone-400">{wallet?.currency ?? 'USD'}</span>
                    </div>
                    <span
                      className={`mt-3 rounded-full px-3 py-1 text-xs font-semibold ${
                        withdrawHasEnoughFunds
                          ? 'bg-emerald-100 text-emerald-700'
                          : withdrawAmountTooHigh
                            ? 'bg-red-100 text-red-700'
                            : 'bg-stone-100 text-stone-500'
                      }`}
                    >
                      {withdrawAmountTooHigh
                        ? `Не хватает: доступно ${money(wallet?.withdrawableBalance ?? 0, wallet?.currency)}`
                        : withdrawHasEnoughFunds
                          ? `Можно вывести: доступно ${money(wallet?.withdrawableBalance ?? 0, wallet?.currency)}`
                          : `Доступно: ${money(wallet?.withdrawableBalance ?? 0, wallet?.currency)}`}
                    </span>
                  </label>
                  <PayoutAddressBook onChange={setWithdrawTarget} />
                </div>
                <button
                  type="submit"
                  disabled={withdrawing || !withdrawTarget || !withdrawAmount || withdrawAmountTooHigh}
                  className="primary-action mt-3 w-full px-4 py-3 text-sm"
                >
                  {withdrawing ? 'Отправляем…' : 'Подтвердить вывод'}
                </button>
              </form>
            )}

            <div className="mt-4 rounded-3xl border border-stone-100 bg-card-sand/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-stone-950">Автовывод</p>
                  <p className="mt-1 text-sm text-stone-600">
                    {autoWithdrawThreshold ? `Порог: ${money(autoWithdrawThreshold, wallet?.currency)}` : 'Создавайте заявку автоматически при достижении порога.'}
                  </p>
                </div>
                <button type="button" onClick={() => setShowAutoWithdraw((v) => !v)} className="secondary-action px-3 py-2 text-sm">
                  {showAutoWithdraw ? 'Закрыть' : 'Настроить'}
                </button>
              </div>
              {showAutoWithdraw && (
                <form onSubmit={submitAutoWithdraw} className="mt-3 grid gap-2 sm:grid-cols-[140px_1fr_auto]">
                  <input
                    type="number"
                    min="1"
                    placeholder="Порог"
                    value={autoWithdrawThreshold}
                    onChange={(e) => setAutoWithdrawThreshold(e.target.value)}
                    className="field-surface px-3 py-2 text-sm"
                  />
                  <select
                    value={autoWithdrawAddressId}
                    onChange={(e) => setAutoWithdrawAddressId(e.target.value)}
                    className="field-surface px-3 py-2 text-sm"
                  >
                    <option value="">Адрес вывода…</option>
                    {savedAddresses.map((addr) => (
                      <option key={addr.id} value={addr.id}>
                        {addr.label} ({addr.network})
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={autoWithdrawSaving || !autoWithdrawThreshold || !autoWithdrawAddressId}
                    className="primary-action px-4 py-2 text-sm"
                  >
                    {autoWithdrawSaving ? '...' : 'Сохранить'}
                  </button>
                  {autoWithdrawThreshold && (
                    <button type="button" onClick={disableAutoWithdraw} disabled={autoWithdrawSaving} className="secondary-action px-4 py-2 text-sm sm:col-span-3">
                      Выключить автовывод
                    </button>
                  )}
                  {autoWithdrawSaved && <p className="text-sm text-emerald-600 sm:col-span-3">Сохранено.</p>}
                </form>
              )}
            </div>

            {showHistory && (
              <div className="mt-4 max-h-[360px] overflow-y-auto rounded-3xl border border-stone-100 bg-white p-2">
                {historyLoading && historyItems.length === 0 && <p className="p-3 text-sm text-stone-500">Загружаем…</p>}
                {!historyLoading && historyItems.length === 0 && <p className="p-3 text-sm text-stone-400">Операций пока не было.</p>}
                <div className="space-y-1">
                  {historyItems.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl px-3 py-2 transition hover:bg-stone-50">
                      <div className="flex items-center gap-3">
                        <span className={`flex h-9 w-9 items-center justify-center rounded-full ${item.direction === 'CREDIT' ? 'bg-card-sage text-emerald-700' : 'bg-card-sand text-stone-700'}`}>
                          <TransactionDirectionIcon direction={item.direction} className="h-6 w-6" />
                        </span>
                        <div>
                          <p className="text-sm font-semibold text-stone-900">{TRANSACTION_TYPE_LABELS[item.type] ?? item.type}</p>
                          <p className="text-xs text-stone-500">{new Date(item.createdAt).toLocaleString('ru-RU')}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <p className={`text-sm font-semibold ${item.direction === 'CREDIT' ? 'text-emerald-600' : 'text-stone-700'}`}>
                          {item.direction === 'CREDIT' ? '+' : '-'}
                          {money(item.amount, item.currency)}
                        </p>
                        <button type="button" title="Скачать чек" onClick={() => downloadFile(`/wallet/transactions/${item.id}/receipt.pdf`, `receipt-${item.id}.pdf`)} className="rounded-full p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700">
                          <DownloadIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                {historyCursor && (
                  <button type="button" onClick={() => loadHistory(historyCursor)} disabled={historyLoading} className="secondary-action mt-2 w-full py-2 text-sm disabled:opacity-50">
                    {historyLoading ? 'Загружаем…' : 'Показать ещё'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
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

      {isFreelancer && recommendedOrders.length > 0 && (
        <section className="premium-panel mb-8 rounded-3xl p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-brand">Лучшие совпадения</p>
              <h2 className="font-serif text-2xl text-stone-900">Заказы, которые стоит посмотреть первыми</h2>
            </div>
            <Link href="/search?type=orders" className="text-sm font-semibold text-brand hover:text-brand-dark">
              Открыть поиск →
            </Link>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {recommendedOrders.map((order) => (
              <Link key={order.id} href={`/orders/${order.id}`} className="interactive-card rounded-3xl border border-stone-100 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="line-clamp-2 text-sm font-semibold text-stone-950">{order.title}</p>
                  {typeof order.matchScore === 'number' && (
                    <span className="rounded-full bg-brand/10 px-2 py-1 text-xs font-bold text-brand">
                      {Math.round(order.matchScore)}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm font-semibold text-stone-900">{money(order.budgetMin, order.currency)}</p>
                {order.matchReasons && order.matchReasons.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {order.matchReasons.slice(0, 2).map((reason) => (
                      <span key={reason} className="rounded-full bg-card-sage/70 px-2 py-1 text-xs font-medium text-stone-700">
                        {reason}
                      </span>
                    ))}
                  </div>
                )}
                {order.missing && order.missing.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {order.missing.slice(0, 2).map((item) => (
                      <span key={item} className="rounded-full bg-card-sand/70 px-2 py-1 text-xs font-medium text-stone-600">
                        {item}
                      </span>
                    ))}
                  </div>
                )}
                {typeof order.compatibilityPercent === 'number' && (
                  <div className="mt-3">
                    <div className="mb-1 flex justify-between text-xs text-stone-500">
                      <span>Совпадение навыков</span>
                      <span>{order.compatibilityPercent}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
                      <div className="h-full rounded-full bg-brand" style={{ width: `${order.compatibilityPercent}%` }} />
                    </div>
                  </div>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {isFreelancer && myBids.length > 0 && (
        <section className="premium-panel mb-8 rounded-3xl p-5">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-brand">Мои отклики</p>
              <h2 className="font-serif text-2xl text-stone-900">Статус ваших откликов</h2>
            </div>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {myBids.map((bid) => {
              const canChatOnBid = bid.status === 'PENDING' || bid.status === 'ACCEPTED';
              return (
                <div key={bid.id} className="interactive-card rounded-3xl border border-stone-100 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/orders/${bid.orderId}`} className="line-clamp-1 break-words font-semibold text-stone-950 hover:text-brand">
                        {bid.order.title}
                      </Link>
                      <p className="mt-1 text-xs text-stone-500">{bid.order.category?.name ?? 'Категория'}</p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        bid.status === 'ACCEPTED'
                          ? 'bg-card-sage/80 text-stone-800'
                          : bid.status === 'REJECTED'
                            ? 'bg-stone-200 text-stone-600'
                            : 'bg-card-sand/80 text-stone-800'
                      }`}
                    >
                      {BID_STATUS_LABELS[bid.status] ?? bid.status}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <p className="font-serif text-xl text-stone-950">
                      {money(bid.amount, bid.order.currency)} <span className="text-xs font-sans font-normal text-stone-500">за {bid.deliveryDays} дн.</span>
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {canChatOnBid && (
                        <Link href={`/chats?orderId=${bid.orderId}&freelancerId=${bid.freelancerId}`} className="rounded-full bg-card-lavender px-3 py-1.5 text-xs font-semibold text-stone-800 transition hover:bg-card-lavender/70">
                          Открыть чат
                        </Link>
                      )}
                      <Link href={`/orders/${bid.orderId}`} className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-semibold text-stone-600 transition hover:bg-stone-200">
                        Открыть заказ
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="space-y-6">
        <section className="premium-panel overflow-hidden rounded-[2.25rem] p-0">
          <div className="border-b border-stone-100 bg-gradient-to-br from-white via-card-sand/35 to-card-sage/35 p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">Рабочая лента</p>
                <h2 className="mt-1 font-serif text-3xl text-stone-950">{roleOrderTitle}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
                  {roleOrderDescription}
                </p>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="hero-stat rounded-[1.5rem] px-4 py-3">
                  <p className="font-serif text-2xl text-stone-950">{isClient && !isFreelancer ? ownOrderCount : orderPool.length}</p>
                  <p className="text-[11px] uppercase text-stone-400">{isClient && !isFreelancer ? 'моих' : 'в ленте'}</p>
                </div>
                <div className="hero-stat rounded-[1.5rem] px-4 py-3">
                  <p className="font-serif text-2xl text-stone-950">{totalBidCount}</p>
                  <p className="text-[11px] uppercase text-stone-400">откликов</p>
                </div>
                <div className="hero-stat rounded-[1.5rem] px-4 py-3">
                  <p className="font-serif text-2xl text-stone-950">{isFreelancer ? invitedCount : availableOrderCount}</p>
                  <p className="text-[11px] uppercase text-stone-400">{isFreelancer ? 'инвайтов' : 'открытых'}</p>
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowSavedOnly(false)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  !showSavedOnly ? 'bg-brand text-white shadow-sm' : 'bg-white/75 text-stone-600 hover:bg-white hover:text-stone-950'
                }`}
              >
                {primaryOrderFilterLabel}
              </button>
              {isFreelancer && (
                <button
                  type="button"
                  onClick={() => setShowSavedOnly(true)}
                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                    showSavedOnly ? 'bg-brand text-white shadow-sm' : 'bg-white/75 text-stone-600 hover:bg-white hover:text-stone-950'
                  }`}
                >
                  Избранное {savedOrders.length > 0 && `(${savedOrders.length})`}
                </button>
              )}
              {isClient && (
                <a href="#create-order" className="rounded-full bg-card-sage/80 px-4 py-2 text-sm font-semibold text-stone-800 transition hover:bg-card-sage">
                  Новый заказ
                </a>
              )}
              {boostedCount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-700">
                  <BoostIcon className="h-4 w-4" />
                  {boostedCount} продвигается
                </span>
              )}
            </div>
          </div>

          <div className="p-5 md:p-6">
            <div className="mb-5 flex flex-wrap gap-2 rounded-[1.75rem] bg-stone-50 p-1.5">
              {ORDER_STATUS_TABS.map((tab) => (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => setOrderStatusView(tab.value)}
                  className={`flex shrink-0 items-center gap-2 rounded-[1.25rem] px-3.5 py-2.5 text-sm font-semibold transition ${
                    orderStatusView === tab.value ? 'bg-white text-brand shadow-sm ring-1 ring-brand/10' : 'text-stone-500 hover:bg-white hover:text-stone-900'
                  }`}
                >
                  {tab.label}
                  <span className={orderStatusView === tab.value ? 'text-brand/70' : 'text-stone-400'}>{orderCounts[tab.value] ?? 0}</span>
                </button>
              ))}
            </div>

            {!showSavedOnly && (
              <div className="mb-5 rounded-[2rem] border border-stone-100 bg-white/70 p-3 shadow-sm backdrop-blur">
                <div className="grid gap-2 xl:grid-cols-[1fr_210px_160px_135px_auto]">
                  <input
                    placeholder="Поиск по названию или описанию"
                    value={orderSearch}
                    onChange={(e) => setOrderSearch(e.target.value)}
                    className="field-surface w-full rounded-[1.35rem] px-4 py-3 text-sm"
                  />
                  <select
                    value={filterCategoryId}
                    onChange={(e) => setFilterCategoryId(e.target.value)}
                    className="field-surface rounded-[1.35rem] px-3 py-3 text-sm"
                  >
                    <option value="">Все категории</option>
                    {flatCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <TagAutocomplete
                    value={filterTags}
                    onChange={setFilterTags}
                    suggestions={skills.map((s) => s.name)}
                    placeholder="Теги — начните вводить..."
                    showChips={false}
                    inputClassName="field-surface rounded-[1.35rem] px-3 py-3 text-sm"
                  />
                  <input
                    type="number"
                    min="0"
                    placeholder="Бюджет от"
                    value={filterMinBudget}
                    onChange={(e) => setFilterMinBudget(e.target.value)}
                    className="field-surface rounded-[1.35rem] px-3 py-3 text-sm"
                  />
                  <button type="button" onClick={clearOrderFilters} disabled={!hasActiveFilter && orderStatusView === 'all'} className="secondary-action rounded-[1.35rem] px-4 py-3 text-sm disabled:opacity-40">
                    Сбросить
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {filterTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setFilterTags((current) => current.filter((t) => t !== tag))}
                      className="rounded-full bg-card-sand px-3 py-1.5 text-xs font-semibold text-stone-700 hover:line-through"
                    >
                      {tag} x
                    </button>
                  ))}
                  {isFreelancer && (
                    <button
                      type="button"
                      onClick={saveCurrentSearch}
                      disabled={!hasActiveFilter || savingSearch || savedSearches.length >= 5}
                      title={savedSearches.length >= 5 ? 'Можно сохранить не больше 5 подписок' : 'Получать уведомление о новых заказах по этому фильтру'}
                      className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-2 text-sm font-semibold text-stone-600 transition hover:border-brand/30 hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <BellIcon className="h-4 w-4" />
                      Сохранить фильтр
                    </button>
                  )}
                </div>

                {savedSearchError && <p className="mt-3 text-xs text-red-600">{savedSearchError}</p>}
                {savedSearches.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-stone-100 pt-3">
                    <span className="text-xs font-semibold uppercase text-stone-400">Подписки</span>
                    {savedSearches.map((savedSearch) => (
                      <span key={savedSearch.id} className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand">
                        <BellIcon className="h-3.5 w-3.5" />
                        {savedSearch.label}
                        <button type="button" onClick={() => deleteSavedSearch(savedSearch.id)} className="hover:text-brand-dark">
                          x
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-4">
              {visibleOrders.map((order) => {
                const bidsCount = order._count?.bids ?? order.bids?.length ?? 0;
                const isOwnOrder = order.clientId === me?.id;
                const canBid = isFreelancer && order.status === 'OPEN' && !isOwnOrder;
                const hasWorkChat = Boolean(order.acceptedBidId);
                const roleHint = isOwnOrder
                  ? bidsCount > 0
                    ? `${bidsCount} откликов ждут решения`
                    : 'Заказ опубликован, отклики появятся здесь'
                  : canBid
                    ? 'Можно быстро отправить отклик'
                    : 'Откройте заказ, чтобы посмотреть детали';
                return (
                  <article key={order.id} className="interactive-card min-w-0 rounded-[2rem] border border-stone-100 bg-white p-4 shadow-sm md:p-5">
                    <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_210px]">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/orders/${order.id}`} className="min-w-0 max-w-full break-words text-lg font-semibold leading-snug text-stone-950 hover:text-brand">
                            {order.title}
                          </Link>
                          {order.isPromoted && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                              <BoostIcon className="h-3 w-3" />
                              Продвигается
                            </span>
                          )}
                          {invitedOrderIds.has(order.id) && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2.5 py-1 text-xs font-semibold text-brand">
                              <TargetIcon className="h-3.5 w-3.5" />
                              Вас пригласили
                            </span>
                          )}
                          {isOwnOrder && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-card-sage/80 px-2.5 py-1 text-xs font-semibold text-stone-800">
                              Ваш заказ
                            </span>
                          )}
                        </div>
                        <p className="mt-2 line-clamp-3 break-words text-sm leading-6 text-stone-600">{order.description}</p>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-semibold text-stone-600">
                          <span className="max-w-full break-words rounded-full bg-stone-100 px-3 py-1">{order.category?.name ?? 'Категория'}</span>
                          <span className="rounded-full bg-card-sage/70 px-3 py-1">{bidsCount} откликов</span>
                          {order.deadline && <span className="rounded-full bg-card-lavender/70 px-3 py-1">До {new Date(order.deadline).toLocaleDateString('ru-RU')}</span>}
                          {order.viewsCount != null && <span className="rounded-full bg-stone-100 px-3 py-1">{order.viewsCount} просмотров</span>}
                        </div>
                        {order.tags && order.tags.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {order.tags.slice(0, 6).map((tag) => (
                              <span key={tag} className="max-w-full break-words rounded-full bg-card-sand px-2.5 py-1 text-xs font-medium text-stone-700">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 rounded-[1.75rem] bg-stone-50 p-3">
                        <div className="flex min-w-0 flex-col items-stretch gap-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs uppercase text-stone-400">Бюджет</p>
                            <p className="mt-1 break-words font-serif text-2xl leading-tight text-stone-950">{money(order.budgetMin, order.currency)}</p>
                            {order.budgetMax && <p className="break-words text-xs text-stone-500">до {money(order.budgetMax, order.currency)}</p>}
                          </div>
                          {isFreelancer && !isOwnOrder && (
                            <button
                              type="button"
                              onClick={() => toggleSaved(order)}
                              title={savedOrderIds.has(order.id) ? 'Убрать из избранного' : 'В избранное'}
                              className="rounded-full bg-white p-2 text-stone-300 shadow-sm transition hover:scale-105 hover:text-amber-500"
                            >
                              <FavoriteOrderIcon active={savedOrderIds.has(order.id)} className="h-6 w-6" />
                            </button>
                          )}
                        </div>
                        <OrderStatusBadge status={order.status} />
                        <div className="rounded-[1.35rem] bg-white/80 px-3 py-2">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">Следующий шаг</p>
                          <p className="mt-1 break-words text-xs font-medium leading-5 text-stone-600">{roleHint}</p>
                        </div>
                        {isOwnOrder && bidsCount > 0 && order.status === 'OPEN' ? (
                          <button type="button" onClick={() => toggleBidsPanel(order.id)} className="primary-action mt-1 px-3 py-2 text-sm">
                            {expandedBidsOrderId === order.id ? 'Свернуть отклики' : 'Разобрать отклики'}
                          </button>
                        ) : canBid ? (
                          <button type="button" onClick={() => setSelectedOrder(order)} className="primary-action mt-1 px-3 py-2 text-sm">
                            Откликнуться
                          </button>
                        ) : (
                          <Link href={`/orders/${order.id}`} className="secondary-action mt-1 px-3 py-2 text-center text-sm">
                            {isOwnOrder ? 'Управлять заказом' : 'Открыть заказ'}
                          </Link>
                        )}
                        {hasWorkChat && (
                          <Link
                            href={`/chats?orderId=${order.id}${order.chatThreads?.[0]?.freelancerId ? `&freelancerId=${order.chatThreads[0].freelancerId}` : ''}`}
                            className="rounded-full bg-card-sage px-3 py-2 text-center text-sm font-semibold text-stone-800"
                          >
                            Открыть чат
                          </Link>
                        )}
                        </div>
                      </div>
                    </div>

                    {isOwnOrder && expandedBidsOrderId === order.id && (
                      <div className="mt-4 rounded-[1.5rem] border border-stone-100 bg-stone-50/70 p-3 md:p-4">
                        {expandedBidsLoading ? (
                          <div className="space-y-2">
                            <Skeleton className="h-16 rounded-2xl" />
                            <Skeleton className="h-16 rounded-2xl" />
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {bidActionError && <ErrorNotice message={bidActionError} />}
                            {(expandedOrderDetail?.bids ?? []).map((bid) => {
                              const freelancerName = bid.freelancer?.profile?.displayName ?? bid.freelancer?.email ?? 'Фрилансер';
                              const canDecide = bid.status === 'PENDING' && order.status === 'OPEN';
                              const isActing = bidActionLoadingId === bid.id;
                              return (
                                <div key={bid.id} className="rounded-[1.25rem] border border-stone-100 bg-white p-3">
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        {bid.freelancerId ? (
                                          <Link href={`/freelancers/${bid.freelancerId}`} className="font-semibold text-stone-950 hover:text-brand">
                                            {freelancerName}
                                          </Link>
                                        ) : (
                                          <span className="font-semibold text-stone-950">{freelancerName}</span>
                                        )}
                                        <span
                                          className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                            bid.status === 'ACCEPTED'
                                              ? 'bg-card-sage/80 text-stone-800'
                                              : bid.status === 'REJECTED'
                                                ? 'bg-stone-200 text-stone-600'
                                                : 'bg-card-sand/80 text-stone-800'
                                          }`}
                                        >
                                          {BID_STATUS_LABELS[bid.status] ?? bid.status}
                                        </span>
                                        {typeof bid.compatibilityPercent === 'number' && (
                                          <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand">
                                            {bid.compatibilityPercent}% совпадение
                                          </span>
                                        )}
                                      </div>
                                      {bid.message && <p className="mt-1.5 break-words text-sm leading-5 text-stone-600">{bid.message}</p>}
                                    </div>
                                    <div className="text-right">
                                      <p className="font-serif text-xl text-stone-950">{money(bid.amount, order.currency)}</p>
                                      <p className="text-xs text-stone-500">{bid.deliveryDays} дн.</p>
                                    </div>
                                  </div>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {canDecide && (
                                      <>
                                        <button
                                          type="button"
                                          disabled={isActing}
                                          onClick={() => respondToBid(order.id, bid.id, 'accept')}
                                          className="primary-action px-3 py-1.5 text-xs disabled:opacity-50"
                                        >
                                          {isActing ? 'Секунду…' : 'Принять'}
                                        </button>
                                        <button
                                          type="button"
                                          disabled={isActing}
                                          onClick={() => respondToBid(order.id, bid.id, 'reject')}
                                          className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-semibold text-stone-600 transition hover:bg-stone-200 disabled:opacity-50"
                                        >
                                          Отклонить
                                        </button>
                                      </>
                                    )}
                                    <Link
                                      href={`/chats?orderId=${order.id}&freelancerId=${bid.freelancerId}`}
                                      className="rounded-full bg-card-lavender px-3 py-1.5 text-xs font-semibold text-stone-800 transition hover:bg-card-lavender/70"
                                    >
                                      Открыть чат
                                    </Link>
                                    <Link href={`/freelancers/${bid.freelancerId}`} className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-semibold text-stone-600 transition hover:bg-stone-200">
                                      Профиль
                                    </Link>
                                  </div>
                                </div>
                              );
                            })}
                            {(expandedOrderDetail?.bids ?? []).length === 0 && (
                              <p className="px-2 py-3 text-center text-sm text-stone-400">Отклики пока не загрузились или их нет.</p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}

              {showSavedOnly && savedOrders.length === 0 && (
                <EmptyState icon={<BuildIcon />} title="В избранном пока пусто" description="Нажмите на звёздочку у заказа, чтобы вернуться к нему позже." />
              )}
              {!showSavedOnly && visibleOrders.length === 0 && (
                <EmptyState
                  icon={<BuildIcon />}
                  title={orders.length === 0 ? 'Заказов пока нет' : 'По этому фильтру ничего нет'}
                  description={orders.length === 0 ? (isClient ? 'Разместите первый заказ справа — отклики начнут приходить сразу.' : 'Загляните позже или сбросьте поиск.') : 'Смените статус, категорию, бюджет или сбросьте фильтры.'}
                />
              )}
            </div>
          </div>
        </section>

        {hasAside && (
        <aside className="space-y-6">
          {isClient && previousFreelancers.length > 0 && (
            <section className="premium-panel rounded-[2rem] p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">Команда</p>
                  <h2 className="mt-1 text-lg font-semibold text-stone-950">Нанимали раньше</h2>
                </div>
                <Mascot name="qualityChecklist" size="h-12 w-12" />
              </div>
              <div className="space-y-2">
                {previousFreelancers.map((f) => (
                  <Link
                    key={f.id}
                    href={`/freelancers/${f.id}`}
                    className="flex items-center gap-3 rounded-[1.5rem] p-2 text-sm transition hover:bg-stone-50"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-card-sand font-serif text-sm text-stone-900">
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

          {isClient && orderDrafts.length > 0 && (
            <section className="premium-panel rounded-[2rem] p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">Черновики</p>
                  <h2 className="mt-1 font-serif text-2xl text-stone-950">Продолжить заказ</h2>
                  <p className="mt-1 text-sm leading-5 text-stone-500">Незавершённые брифы не теряются: допишите и публикуйте, когда готовы.</p>
                </div>
                <span className="rounded-full bg-card-sand px-3 py-1 text-xs font-semibold text-stone-700">{orderDrafts.length}</span>
              </div>
              <div className="space-y-2">
                {orderDrafts.slice(0, 4).map((draft) => (
                  <div key={draft.id} className="rounded-[1.35rem] border border-stone-100 bg-white/75 p-3">
                    <p className="break-words text-sm font-semibold text-stone-950">{draft.title === 'Черновик заказа' ? 'Без названия' : draft.title}</p>
                    <p className="mt-1 break-words text-xs leading-5 text-stone-500">
                      {draft.description || 'Описание ещё не заполнено'}
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <button type="button" onClick={() => continueDraft(draft)} className="primary-action px-3 py-2 text-sm">
                        Продолжить
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteDraft(draft.id)}
                        disabled={deletingDraftId === draft.id}
                        className="secondary-action px-3 py-2 text-sm disabled:opacity-50"
                      >
                        {deletingDraftId === draft.id ? 'Удаляем...' : 'Удалить'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}


          {selectedOrder && (
            <section className="premium-panel rounded-[2rem] p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">Отклик</p>
                  <h2 className="mt-1 font-serif text-2xl text-stone-950">Предложение заказчику</h2>
                  <p className="mt-1 text-sm leading-5 text-stone-500">{selectedOrder.title}</p>
                </div>
                <Mascot name="magnifierPro" size="h-14 w-14" />
              </div>
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
                    className="field-surface w-full rounded-[1.35rem] px-3 py-3 text-sm text-stone-600"
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
                  className="field-surface w-full rounded-[1.35rem] px-3 py-3 text-sm"
                />
                <input
                  required
                  type="number"
                  min="1"
                  placeholder="Дней на выполнение"
                  value={bidForm.deliveryDays}
                  onChange={(e) => setBidForm({ ...bidForm, deliveryDays: e.target.value })}
                  className="field-surface w-full rounded-[1.35rem] px-3 py-3 text-sm"
                />
                <textarea
                  required
                  placeholder="Сообщение заказчику"
                  value={bidForm.message}
                  onChange={(e) => setBidForm({ ...bidForm, message: e.target.value })}
                  className="field-surface min-h-28 w-full rounded-[1.35rem] px-3 py-3 text-sm"
                />
                <button type="submit" className="primary-action w-full rounded-[1.35rem] px-4 py-3 font-medium">
                  Отправить отклик
                </button>
              </form>
            </section>
          )}
        </aside>
        )}
      </div>
      {isClient && (
        <section id="create-order" className="premium-panel mt-6 scroll-mt-28 overflow-hidden rounded-[2rem] p-0">
          <div className="border-b border-stone-100 bg-gradient-to-br from-card-sand/65 via-white to-card-sage/45 p-6 md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">Публикация</p>
                <h2 className="mt-1 font-serif text-4xl leading-tight text-stone-950">Создать заказ</h2>
                <p className="mt-2 max-w-xl text-sm leading-6 text-stone-600">
                  Чем яснее стартовый бриф, тем меньше лишних вопросов и тем быстрее появятся сильные отклики.
                </p>
              </div>
              <Mascot name="workLaptop" size="h-16 w-16" />
            </div>
          </div>

          <form onSubmit={createOrder} className="grid gap-6 p-6 md:p-8 lg:grid-cols-[1.3fr_1fr]">
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-stone-400">Категория</span>
                  <select
                    value={orderFormParentCategory?.id ?? ''}
                    onChange={(e) => setOrderForm({ ...orderForm, categoryId: e.target.value })}
                    className="field-surface w-full rounded-[1.35rem] px-3 py-3 text-sm"
                  >
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
                {(orderFormParentCategory?.children?.length ?? 0) > 0 && (
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-stone-400">Ниша (необязательно)</span>
                    <select
                      value={orderForm.categoryId}
                      onChange={(e) => setOrderForm({ ...orderForm, categoryId: e.target.value })}
                      className="field-surface w-full rounded-[1.35rem] px-3 py-3 text-sm"
                    >
                      <option value={orderFormParentCategory!.id}>Без уточнения — вся категория</option>
                      {orderFormParentCategory!.children!.map((niche) => (
                        <option key={niche.id} value={niche.id}>
                          {niche.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-stone-400">Название результата</span>
                <input
                  required
                  minLength={5}
                  placeholder="Например: лендинг для SaaS с оплатой Stripe"
                  value={orderForm.title}
                  onChange={(e) => setOrderForm({ ...orderForm, title: e.target.value })}
                  className="field-surface w-full rounded-[1.35rem] px-3 py-3 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-stone-400">Описание задачи</span>
                <textarea
                  required
                  minLength={20}
                  placeholder="Что нужно сделать, какой результат ожидаете, какие ограничения, доступы, материалы и критерии готовности..."
                  value={orderForm.description}
                  onChange={(e) => setOrderForm({ ...orderForm, description: e.target.value })}
                  className="field-surface min-h-36 w-full rounded-[1.35rem] px-3 py-3 text-sm leading-6"
                />
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="field-surface block rounded-[1.35rem] px-3 py-3">
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">Бюджет от</span>
                  <input
                    required
                    type="number"
                    min="1"
                    placeholder="0"
                    value={orderForm.budgetMin}
                    onChange={(e) => setOrderForm({ ...orderForm, budgetMin: e.target.value })}
                    className="mt-1 w-full border-0 bg-transparent p-0 font-serif text-2xl leading-none text-stone-950 outline-none ring-0 placeholder:text-stone-300 focus:border-0 focus:ring-0"
                  />
                </label>
                <label className="field-surface block rounded-[1.35rem] px-3 py-3">
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">До</span>
                  <input
                    type="number"
                    min="1"
                    placeholder="Необязательно"
                    value={orderForm.budgetMax}
                    onChange={(e) => setOrderForm({ ...orderForm, budgetMax: e.target.value })}
                    className="mt-1 w-full border-0 bg-transparent p-0 font-serif text-2xl leading-none text-stone-950 outline-none ring-0 placeholder:text-stone-300 focus:border-0 focus:ring-0"
                  />
                </label>
              </div>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-stone-400">Желаемый срок</span>
                <input
                  type="date"
                  value={orderForm.deadline}
                  onChange={(e) => setOrderForm({ ...orderForm, deadline: e.target.value })}
                  className="field-surface w-full rounded-[1.35rem] px-3 py-3 text-sm"
                />
              </label>
              <div>
                <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.12em] text-stone-400">Стек и теги</span>
                <TagAutocomplete
                  value={orderForm.tags}
                  onChange={(tags) => setOrderForm((f) => ({ ...f, tags }))}
                  suggestions={skills.map((s) => s.name)}
                  placeholder="Начните вводить стек — React, Node.js…"
                  chipClassName="max-w-full break-words rounded-full bg-card-sand px-2.5 py-1 text-xs font-medium text-stone-700 hover:line-through"
                  inputClassName="field-surface w-full rounded-[1.35rem] px-3 py-3 text-sm"
                />
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-[1.5rem] bg-white/80 p-4 shadow-sm">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-400">Готовность</span>
                  <span className="rounded-full bg-card-sand px-2.5 py-1 text-xs font-semibold text-stone-700">{orderFormProgress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-stone-100">
                  <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${orderFormProgress}%` }} />
                </div>
                <div className="mt-3 grid gap-2 text-xs font-semibold text-stone-700">
                  {orderFormChecks.map((item) => (
                    <div key={item.label} className="flex items-center justify-between gap-3 rounded-full bg-stone-50 px-3 py-2">
                      <span className="break-words">{item.label}</span>
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${item.done ? 'bg-emerald-500' : 'bg-stone-300'}`} />
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[1.5rem] bg-stone-50 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-stone-400">Превью публикации</p>
                <p className="mt-1 break-words text-sm font-semibold text-stone-950">{orderForm.title || 'Название появится здесь'}</p>
                <p className="mt-1 text-xs font-semibold text-brand">{orderFormBudgetPreview}</p>
              </div>

              {editingDraftId && (
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-[1.25rem] bg-card-lavender/65 px-3 py-2">
                  <p className="text-xs font-semibold text-stone-700">Редактируете сохранённый черновик</p>
                  <button type="button" onClick={() => setEditingDraftId(null)} className="text-xs font-semibold text-brand hover:text-brand-dark">
                    Создать новый
                  </button>
                </div>
              )}
              {orderFormNotice && <p className="rounded-[1.25rem] bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">{orderFormNotice}</p>}

              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={saveOrderDraft}
                  disabled={savingOrderDraft || !orderForm.categoryId}
                  className="secondary-action rounded-[1.35rem] px-4 py-3 text-sm font-semibold disabled:opacity-50"
                >
                  {savingOrderDraft ? 'Сохраняем...' : editingDraftId ? 'Обновить черновик' : 'Сохранить черновик'}
                </button>
                <button
                  type="submit"
                  disabled={creatingOrder || !orderFormReady}
                  className="primary-action rounded-[1.35rem] px-4 py-3 font-semibold disabled:opacity-50"
                >
                  {creatingOrder ? 'Публикуем...' : editingDraftId ? 'Опубликовать черновик' : 'Опубликовать'}
                </button>
              </div>
            </div>
          </form>
        </section>
      )}
    </main>
  );
}
