'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { Toggle } from '@/components/Toggle';
import { AppHeader } from '@/components/AppHeader';
import { ErrorNotice } from '@/components/ErrorNotice';
import { EmptyState } from '@/components/EmptyState';
import { MatchIcon } from '@/components/icons/illustrated/MatchIcon';
import { ChatIcon } from '@/components/icons/illustrated/ChatIcon';
import { EscrowIcon } from '@/components/icons/illustrated/EscrowIcon';
import { BuildIcon } from '@/components/icons/illustrated/BuildIcon';
import { Mascot } from '@/components/Mascot';
import { BarChart, LineChart, FunnelChart } from '@/components/admin/AdminCharts';
import type { Category, CommissionRule, Dispute, FeatureFlag, Skill, User } from '@/lib/types';

const ORDER_STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Черновик',
  OPEN: 'Открыт',
  IN_PROGRESS: 'В работе',
  IN_REVIEW: 'На проверке',
  COMPLETED: 'Завершён',
  CANCELLED: 'Отменён',
  DISPUTED: 'В споре',
  EXPIRED: 'Истёк',
};

const DISPUTE_STATUS_LABEL: Record<string, string> = {
  OPEN: 'Открыт',
  UNDER_REVIEW: 'На рассмотрении',
  RESOLVED_CLIENT: 'Решён в пользу заказчика',
  RESOLVED_FREELANCER: 'Решён в пользу исполнителя',
  RESOLVED_SPLIT: 'Решён частично',
  CLOSED: 'Закрыт',
};

const USER_STATUS_LABEL: Record<string, string> = {
  PENDING_VERIFICATION: 'Ждёт подтверждения email',
  ACTIVE: 'Активен',
  SUSPENDED: 'Приостановлен',
  BANNED: 'Забанен',
  DELETED: 'Удалён',
};

const TICKET_STATUS_LABEL: Record<string, string> = {
  OPEN: 'Открыт',
  PENDING: 'Ожидает ответа поддержки',
  RESOLVED: 'Решён',
  CLOSED: 'Закрыт',
};

const TICKET_PRIORITY_LABEL: Record<string, string> = {
  LOW: 'Низкий',
  NORMAL: 'Обычный',
  HIGH: 'Высокий',
  URGENT: 'Срочный',
};

const FEATURE_FLAG_LABEL: Record<string, { title: string; description: string }> = {
  AI_FRAUD_SCORING: { title: 'AI-скоринг фрода', description: 'Автоматическая оценка риска заказов/профилей моделью — вне модели используется только rule-based антифрод.' },
  REFERRALS: { title: 'Реферальная программа', description: 'Начисление реферальных вознаграждений (сама вкладка сейчас переиспользована под «Партнёрство» — контакты для рекламы/сотрудничества, флаг на неё не влияет).' },
  MILESTONES: { title: 'Этапы (milestones)', description: 'Разбивка заказа на оплачиваемые этапы вместо оплаты целиком.' },
  TELEGRAM_NOTIFICATIONS: { title: 'Уведомления в Telegram', description: 'Дублирование уведомлений в Telegram-бот (пока не подключён).' },
  WALLET: { title: 'Кошелёк и эскроу', description: 'Вся денежная механика: баланс, вывод, эскроу-платежи. Выключать только в экстренной ситуации.' },
};

const COMMISSION_TYPE_LABEL: Record<string, string> = {
  MARKETPLACE_FEE: 'Комиссия площадки (со сделок)',
  WITHDRAWAL_FEE: 'Комиссия за вывод средств',
  REFERRAL_FEE: 'Реферальное вознаграждение',
};

const SUBSCRIPTION_STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Активна',
  CANCELLED: 'Отменена',
  EXPIRED: 'Истекла',
};

const SEVERITY_LABEL: Record<string, string> = {
  LOW: 'низкий',
  MEDIUM: 'средний',
  HIGH: 'высокий',
  CRITICAL: 'критичный',
};

// Category.slug/Skill.slug обязательны и уникальны на бэке — генерируем
// сами, чтобы не заставлять staff придумывать slug руками в форме.
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '');
}

type Tab = 'users' | 'disputes' | 'moderation' | 'flags' | 'commissions' | 'catalog' | 'metrics' | 'finance' | 'subscriptions' | 'audit' | 'support' | 'chats';

interface AdminMetrics {
  revenue: { total: number; thisMonth: number };
  activeDisputes: number;
  ordersByStatus: Record<string, number>;
  newUsersThisWeek: number;
  activeSubscriptionsByTier: Record<string, number>;
}

interface FinanceOverview {
  systemMainBalance: string;
  totalRevenue: string;
  totalEscrowLocked: string;
  totalPaidOutToFreelancers: number;
  subscriptionRevenueFromBalancePayments: string;
}

interface AdminSubscription {
  id: string;
  userId: string;
  userEmail: string;
  userDisplayName: string;
  tierName: 'STARTER' | 'PRO' | 'PREMIUM';
  status: string;
  startedAt: string | null;
  expiresAt: string | null;
}

interface SubscriptionsResponse {
  subscriptions: AdminSubscription[];
  activeCountsByTierName: Record<string, number>;
}

interface AuditLogEntry {
  id: string;
  actorId: string | null;
  actorName: string;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface AuditLogsResponse {
  items: AuditLogEntry[];
  nextCursor: string | null;
}

interface RevenuePoint {
  date: string;
  revenue: number;
  gmv: number;
  newUsers: number;
  newOrders: number;
}

interface AdminFunnel {
  registered: number;
  onboarded: number;
  postedOrRespondedFirst: number;
  paidOrEarnedFirst: number;
}

interface TopCategory {
  categoryId: string;
  categoryName: string;
  orderCount: number;
  gmv: number;
}

interface TopFreelancer {
  userId: string;
  displayName: string;
  earnings: number;
  ordersCompleted: number;
  avgRating: number | null;
}

interface SupportTicketMessage {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
  sender?: { profile?: { displayName?: string } | null; email?: string };
}

interface SupportTicketDetail {
  id: string;
  userId: string;
  disputeId: string | null;
  subject: string;
  status: 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  createdAt: string;
  updatedAt: string;
  messages: SupportTicketMessage[];
  assignedTo?: { id: string; profile?: { displayName?: string } | null } | null;
  user?: { id: string; profile?: { displayName?: string } | null; email?: string };
}

interface AdminChatThreadSummary {
  threadId: string;
  orderId: string;
  orderTitle: string;
  client: { id: string; displayName: string };
  freelancer: { id: string; displayName: string };
  lastMessageAt: string;
}

interface AdminChatMessage {
  id: string;
  type: 'TEXT' | 'INVOICE' | 'FILE' | 'SYSTEM';
  body: string | null;
  createdAt: string;
  sender?: { profile?: { displayName?: string } | null; email?: string };
  invoice?: { amount: string; status: string } | null;
  file?: { url: string } | null;
}

interface AdminChatThreadDetail {
  threadId: string;
  orderId: string;
  orderTitle: string;
  client: { id: string; displayName: string };
  freelancer: { id: string; displayName: string };
  messages: AdminChatMessage[];
}

type ModerationAction = 'APPROVE' | 'REJECT' | 'REQUEST_EDITS';

interface ModerationQueue {
  orders: Array<{
    type: 'ORDER';
    id: string;
    severity: string;
    reasons: string[];
    riskScore: number;
    order?: { id: string; title: string } | null;
    user?: { id: string; displayName: string } | null;
    createdAt: string;
  }>;
  profiles: Array<{
    type: 'PROFILE';
    id: string;
    severity: string;
    reasons: string[];
    riskScore: number;
    user?: { id: string; displayName: string } | null;
    createdAt: string;
  }>;
  reviews: Array<{
    type: 'REVIEW';
    id: string;
    rating: number;
    comment?: string | null;
    author: { id: string; displayName: string };
    target: { id: string; displayName: string };
    createdAt: string;
  }>;
}

export default function AdminPage() {
  useRequireAuth();
  const [tab, setTab] = useState<Tab>('users');
  const [me, setMe] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [commissions, setCommissions] = useState<CommissionRule[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [moderation, setModeration] = useState<ModerationQueue | null>(null);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newSkillName, setNewSkillName] = useState('');
  const [notesByDispute, setNotesByDispute] = useState<Record<string, string>>({});
  const [notesByModeration, setNotesByModeration] = useState<Record<string, string>>({});
  const [finance, setFinance] = useState<FinanceOverview | null>(null);
  const [subscriptionsData, setSubscriptionsData] = useState<SubscriptionsResponse | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [grantForm, setGrantForm] = useState({ userId: '', tierName: 'PRO' as 'PRO' | 'PREMIUM', days: '30' });
  const [grantError, setGrantError] = useState<string | null>(null);
  const [revenueTimeseries, setRevenueTimeseries] = useState<RevenuePoint[]>([]);
  const [funnel, setFunnel] = useState<AdminFunnel | null>(null);
  const [topCategories, setTopCategories] = useState<TopCategory[]>([]);
  const [topFreelancers, setTopFreelancers] = useState<TopFreelancer[]>([]);
  const [metricsChartView, setMetricsChartView] = useState<'money' | 'activity'>('money');
  const [tickets, setTickets] = useState<SupportTicketDetail[]>([]);
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [activeTicket, setActiveTicket] = useState<SupportTicketDetail | null>(null);
  const [ticketReply, setTicketReply] = useState('');
  const [ticketStatusFilter, setTicketStatusFilter] = useState<string>('');
  const [chatSearchOrderId, setChatSearchOrderId] = useState('');
  const [chatSearchUserId, setChatSearchUserId] = useState('');
  const [chatThreads, setChatThreads] = useState<AdminChatThreadSummary[]>([]);
  const [chatSearched, setChatSearched] = useState(false);
  const [activeChatThreadId, setActiveChatThreadId] = useState<string | null>(null);
  const [activeChatThread, setActiveChatThread] = useState<AdminChatThreadDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<User>('/users/me')
      .then(setMe)
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить профиль'));
  }, []);

  useEffect(() => {
    if (!me?.isStaff) return;
    refresh().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, tab, ticketStatusFilter]);

  async function refresh() {
    setError(null);
    try {
      if (tab === 'users') setUsers(await api<User[]>('/admin/users'));
      if (tab === 'disputes') setDisputes(await api<Dispute[]>('/admin/disputes'));
      if (tab === 'flags') setFlags(await api<FeatureFlag[]>('/admin/feature-flags'));
      if (tab === 'commissions') setCommissions(await api<CommissionRule[]>('/admin/commission-rules'));
      if (tab === 'moderation') setModeration(await api<ModerationQueue>('/admin/moderation-queue'));
      if (tab === 'catalog') {
        setCategories(await api<Category[]>('/categories'));
        setSkills(await api<Skill[]>('/skills'));
      }
      if (tab === 'metrics') {
        const [m, ts, f, cats, freelancers] = await Promise.all([
          api<AdminMetrics>('/admin/metrics'),
          api<RevenuePoint[]>('/admin/metrics/revenue-timeseries?days=30'),
          api<AdminFunnel>('/admin/metrics/funnel?days=30'),
          api<TopCategory[]>('/admin/metrics/top-categories?limit=8'),
          api<TopFreelancer[]>('/admin/metrics/top-freelancers?limit=8'),
        ]);
        setMetrics(m);
        setRevenueTimeseries(ts);
        setFunnel(f);
        setTopCategories(cats);
        setTopFreelancers(freelancers);
      }
      if (tab === 'finance') setFinance(await api<FinanceOverview>('/admin/finance/overview'));
      if (tab === 'subscriptions') setSubscriptionsData(await api<SubscriptionsResponse>('/admin/subscriptions'));
      if (tab === 'audit') setAuditLogs((await api<AuditLogsResponse>('/admin/audit-logs')).items);
      if (tab === 'support') {
        const list = await api<SupportTicketDetail[]>(`/support/tickets${ticketStatusFilter ? `?status=${ticketStatusFilter}` : ''}`);
        setTickets(list);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить данные');
    }
  }

  async function openTicket(ticketId: string) {
    setActiveTicketId(ticketId);
    setError(null);
    try {
      setActiveTicket(await api<SupportTicketDetail>(`/support/tickets/${ticketId}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось открыть тикет');
    }
  }

  async function refreshActiveTicket() {
    if (!activeTicketId) return;
    setActiveTicket(await api<SupportTicketDetail>(`/support/tickets/${activeTicketId}`));
    await refresh();
  }

  async function sendTicketReply(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!activeTicketId || !ticketReply.trim()) return;
    setError(null);
    try {
      await api(`/support/tickets/${activeTicketId}/messages`, { method: 'POST', body: JSON.stringify({ body: ticketReply.trim() }) });
      setTicketReply('');
      await refreshActiveTicket();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить ответ');
    }
  }

  async function assignTicketToMe() {
    if (!activeTicketId) return;
    setError(null);
    try {
      await api(`/support/tickets/${activeTicketId}/assign`, { method: 'PATCH' });
      await refreshActiveTicket();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось назначить тикет');
    }
  }

  async function setTicketStatus(status: 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED') {
    if (!activeTicketId) return;
    setError(null);
    try {
      await api(`/support/tickets/${activeTicketId}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      await refreshActiveTicket();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось изменить статус');
    }
  }

  async function searchChats(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const orderId = chatSearchOrderId.trim();
    const userId = chatSearchUserId.trim();
    if (!orderId && !userId) return;
    setError(null);
    setChatSearched(true);
    setActiveChatThreadId(null);
    setActiveChatThread(null);
    try {
      const query = orderId ? `orderId=${encodeURIComponent(orderId)}` : `userId=${encodeURIComponent(userId)}`;
      setChatThreads(await api<AdminChatThreadSummary[]>(`/admin/chats?${query}`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось найти переписки');
    }
  }

  async function openChatThread(threadId: string) {
    setActiveChatThreadId(threadId);
    setError(null);
    try {
      setActiveChatThread(await api<AdminChatThreadDetail>(`/admin/chats/${threadId}/messages`));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось открыть переписку');
    }
  }

  async function mutate(action: () => Promise<unknown>) {
    setError(null);
    try {
      await action();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Операция не выполнена');
    }
  }

  async function resolveModeration(kind: 'orders' | 'profiles' | 'reviews', id: string, action: ModerationAction = 'APPROVE') {
    const note = notesByModeration[id];
    await mutate(() =>
      api(`/admin/moderation-queue/${kind}/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action, note }),
      }),
    );
  }

  if (me && !me.isStaff) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <AppHeader />
        <section className="mt-6 rounded-2xl border border-stone-100 bg-white p-6 shadow-sm">
          <h1 className="font-serif text-2xl text-stone-900">Admin</h1>
          <p className="mt-2 text-stone-600">Для этого раздела нужен staff-доступ.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <AppHeader />

      <section className="workspace-hero mb-6 p-6 md:p-8">
        <div className="relative grid gap-6 lg:grid-cols-[1fr_360px] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Панель управления</p>
            <h1 className="mt-3 font-serif text-3xl leading-tight text-stone-950 md:text-5xl">Пульт качества маркетплейса</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-stone-600">
              Метрики, финансы, споры, поддержка, пользователи, комиссии и каталог собраны в одном рабочем контуре для быстрых решений команды.
            </p>
          </div>
          <div className="rounded-3xl border border-stone-100 bg-white/65 p-4 shadow-sm backdrop-blur">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">Сводка</p>
              <Mascot name="workLaptop" size="h-14 w-14" />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="hero-stat p-3">
                <p className="font-serif text-2xl text-stone-950">{users.length}</p>
                <p className="text-[11px] uppercase text-stone-400">юзеров</p>
              </div>
              <div className="hero-stat p-3">
                <p className="font-serif text-2xl text-stone-950">{disputes.length}</p>
                <p className="text-[11px] uppercase text-stone-400">споров</p>
              </div>
              <div className="hero-stat p-3">
                <p className="font-serif text-2xl text-stone-950">
                  {moderation ? moderation.orders.length + moderation.profiles.length + moderation.reviews.length : flags.length}
                </p>
                <p className="text-[11px] uppercase text-stone-400">в очереди</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="premium-panel mb-6 flex flex-wrap items-center gap-2 p-2">
        {[
          ['metrics', 'Метрики'],
          ['finance', 'Финансы'],
          ['subscriptions', 'Подписки'],
          ['users', 'Пользователи'],
          ['disputes', 'Споры'],
          ['support', 'Поддержка'],
          ['chats', 'Чаты заказов'],
          ['moderation', 'Модерация'],
          ['flags', 'Флаги функций'],
          ['commissions', 'Комиссии'],
          ['catalog', 'Категории и навыки'],
          ['audit', 'Логи действий'],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key as Tab)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              tab === key ? 'bg-brand text-white shadow-sm' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-950'
            }`}
          >
            {label}
          </button>
        ))}
        <Mascot name="alertWarning" size="ml-auto h-12 w-12" />
      </div>

      {error && <ErrorNotice message={error} />}
      {loading && <p className="text-stone-500">Загружаем...</p>}

      {tab === 'users' && (
        <section className="space-y-3">
          <p className="text-xs text-stone-500">Показаны последние 100 пользователей.</p>
          {users.map((user) => {
            const statusTone =
              user.status === 'ACTIVE'
                ? 'bg-emerald-100 text-emerald-700'
                : user.status === 'SUSPENDED'
                  ? 'bg-amber-100 text-amber-700'
                  : user.status === 'BANNED'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-stone-100 text-stone-600';
            return (
              <article key={user.id} className="interactive-card flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{user.profile?.displayName ?? user.email}</p>
                    {user.status && <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusTone}`}>{USER_STATUS_LABEL[user.status] ?? user.status}</span>}
                    {user.isStaff && <span className="rounded-full bg-card-lavender px-2.5 py-0.5 text-[11px] font-semibold text-stone-700">Staff</span>}
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${user.totpEnabled ? 'bg-emerald-50 text-emerald-600' : 'bg-stone-100 text-stone-400'}`}>
                      {user.totpEnabled ? '2FA включена' : '2FA выключена'}
                    </span>
                  </div>
                  <p className="text-sm text-stone-500">{user.email}</p>
                  <p className="text-xs text-stone-400">{user.primaryRole === 'CLIENT' ? 'Заказчик' : 'Фрилансер'}</p>
                </div>
                <div className="flex gap-2">
                  <Link href={`/freelancers/${user.id}`} className="secondary-action px-3 py-2 text-sm font-medium">
                    Профиль
                  </Link>
                  <button
                    type="button"
                    disabled={!user.totpEnabled}
                    title={user.totpEnabled ? undefined : 'У этого пользователя 2FA не привязана — сбрасывать нечего'}
                    onClick={() => mutate(() => api(`/admin/users/${user.id}/reset-2fa`, { method: 'POST' }))}
                    className="secondary-action px-3 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Сбросить 2FA
                  </button>
                  <button
                    type="button"
                    onClick={() => mutate(() => api(`/admin/users/${user.id}/suspend`, { method: 'POST' }))}
                    className="secondary-action px-3 py-2 text-sm font-medium"
                  >
                    Приостановить
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!confirm(`Забанить ${user.profile?.displayName ?? user.email}? Это заблокирует вход в аккаунт.`)) return;
                      mutate(() => api(`/admin/users/${user.id}/ban`, { method: 'POST' }));
                    }}
                    className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
                  >
                    Забанить
                  </button>
                </div>
              </article>
            );
          })}
          {!loading && users.length === 0 && <EmptyState icon={<MatchIcon />} title="Пользователей пока нет" />}
        </section>
      )}

      {tab === 'disputes' && (
        <section className="space-y-3">
          <p className="text-xs text-stone-500">
            При открытии спора участнику автоматически заводится тикет поддержки («Спор по заказу «…»») — переписка и решение видны
            на вкладке «Поддержка».
          </p>
          {disputes.map((dispute) => {
            const resolved = dispute.status.startsWith('RESOLVED') || dispute.status === 'CLOSED';
            return (
              <article key={dispute.id} className="interactive-card rounded-2xl p-4">
                <div className="flex flex-wrap justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{dispute.order?.title ?? `Заказ ${dispute.orderId}`}</p>
                    <p className="text-xs text-stone-400">Открыл: {dispute.openedBy?.profile?.displayName ?? dispute.openedBy?.email ?? '—'}</p>
                    <p className="mt-2 text-sm text-stone-600">{dispute.reason}</p>
                    {dispute.resolutionNotes && (
                      <p className="mt-2 rounded-xl bg-stone-50 p-2 text-xs text-stone-600">
                        <span className="font-semibold text-stone-700">Решение: </span>
                        {dispute.resolutionNotes}
                      </p>
                    )}
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${resolved ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}
                  >
                    {DISPUTE_STATUS_LABEL[dispute.status] ?? dispute.status}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/orders/${dispute.orderId}`} className="secondary-action px-3 py-2 text-xs font-semibold">
                    Открыть заказ
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      setTab('support');
                      setTicketStatusFilter('');
                    }}
                    className="secondary-action px-3 py-2 text-xs font-semibold"
                  >
                    Найти тикет поддержки
                  </button>
                  {dispute.chatThreadId && (
                    <button
                      type="button"
                      onClick={() => {
                        setTab('chats');
                        openChatThread(dispute.chatThreadId!);
                      }}
                      className="secondary-action px-3 py-2 text-xs font-semibold"
                    >
                      Открыть чат заказа
                    </button>
                  )}
                </div>
                {!resolved && (
                  <>
                    <textarea
                      placeholder="Комментарий к решению (виден пользователю в тикете поддержки)"
                      value={notesByDispute[dispute.id] ?? ''}
                      onChange={(e) => setNotesByDispute({ ...notesByDispute, [dispute.id]: e.target.value })}
                      className="field-surface mt-4 min-h-20 w-full px-3 py-2"
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => mutate(() => api(`/admin/disputes/${dispute.id}/assign`, { method: 'PATCH' }))}
                        className="secondary-action px-3 py-2 text-sm font-medium"
                      >
                        Взять в работу
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!confirm('Решить спор в пользу заказчика? Деньги вернутся ему из эскроу.')) return;
                          mutate(() =>
                            api(`/admin/disputes/${dispute.id}/resolve`, {
                              method: 'PATCH',
                              body: JSON.stringify({ resolution: 'RESOLVED_CLIENT', notes: notesByDispute[dispute.id] }),
                            }),
                          );
                        }}
                        className="rounded-lg bg-stone-900 px-3 py-2 text-sm font-medium text-white hover:bg-stone-800"
                      >
                        Заказчик прав
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (!confirm('Решить спор в пользу исполнителя? Эскроу будет отпущен ему за вычетом комиссии.')) return;
                          mutate(() =>
                            api(`/admin/disputes/${dispute.id}/resolve`, {
                              method: 'PATCH',
                              body: JSON.stringify({ resolution: 'RESOLVED_FREELANCER', notes: notesByDispute[dispute.id] }),
                            }),
                          );
                        }}
                        className="primary-action px-3 py-2 text-sm font-medium"
                      >
                        Исполнитель прав
                      </button>
                    </div>
                    <p className="mt-2 text-[11px] text-stone-400">Частичное решение (сплит между сторонами) пока не реализовано на бэкенде.</p>
                  </>
                )}
              </article>
            );
          })}
          {!loading && disputes.length === 0 && <EmptyState icon={<EscrowIcon />} title="Активных споров нет" />}
        </section>
      )}

      {tab === 'support' && (
        <section className="grid gap-5 lg:grid-cols-[380px_1fr]">
          <div className="premium-panel overflow-hidden rounded-[2rem] p-0">
            <div className="border-b border-stone-100 p-4">
              <h3 className="font-semibold">Тикеты поддержки</h3>
              <select
                value={ticketStatusFilter}
                onChange={(e) => setTicketStatusFilter(e.target.value)}
                className="field-surface mt-2 w-full px-3 py-2 text-sm"
              >
                <option value="">Все статусы</option>
                <option value="OPEN">Открыт</option>
                <option value="PENDING">Ожидает ответа поддержки</option>
                <option value="RESOLVED">Решён</option>
                <option value="CLOSED">Закрыт</option>
              </select>
            </div>
            <div className="max-h-[640px] divide-y divide-stone-100 overflow-y-auto">
              {tickets.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => openTicket(t.id)}
                  className={`w-full p-4 text-left transition ${activeTicketId === t.id ? 'bg-brand/10' : 'hover:bg-stone-50'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-sm font-semibold text-stone-900">{t.subject}</p>
                    {t.disputeId && <span className="shrink-0 rounded-full bg-card-rose px-2 py-0.5 text-[10px] font-bold text-stone-700">Спор</span>}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-stone-500">{t.user?.profile?.displayName ?? t.user?.email ?? '—'}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        t.status === 'OPEN'
                          ? 'bg-amber-100 text-amber-700'
                          : t.status === 'PENDING'
                            ? 'bg-brand/10 text-brand'
                            : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {TICKET_STATUS_LABEL[t.status] ?? t.status}
                    </span>
                    <span className="text-[10px] text-stone-400">{TICKET_PRIORITY_LABEL[t.priority] ?? t.priority}</span>
                  </div>
                </button>
              ))}
              {!loading && tickets.length === 0 && <p className="p-4 text-sm text-stone-500">Тикетов нет.</p>}
            </div>
          </div>

          <div className="premium-panel flex min-h-[500px] flex-col overflow-hidden rounded-[2rem] p-0">
            {!activeTicket ? (
              <div className="flex flex-1 items-center justify-center p-8">
                <EmptyState icon={<ChatIcon />} title="Выберите тикет" description="Слева список обращений в поддержку, включая автоматически заведённые из споров." />
              </div>
            ) : (
              <>
                <div className="border-b border-stone-100 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-serif text-xl text-stone-950">{activeTicket.subject}</h3>
                      <p className="text-xs text-stone-500">
                        {activeTicket.user?.profile?.displayName ?? activeTicket.user?.email ?? '—'}
                        {activeTicket.assignedTo && ` · назначен: ${activeTicket.assignedTo.profile?.displayName ?? 'staff'}`}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {!activeTicket.assignedTo && (
                        <button type="button" onClick={assignTicketToMe} className="secondary-action px-3 py-2 text-xs font-semibold">
                          Взять себе
                        </button>
                      )}
                      <select
                        value={activeTicket.status}
                        onChange={(e) => setTicketStatus(e.target.value as 'OPEN' | 'PENDING' | 'RESOLVED' | 'CLOSED')}
                        className="field-surface px-3 py-2 text-xs"
                      >
                        <option value="OPEN">Открыт</option>
                        <option value="PENDING">Ожидает ответа</option>
                        <option value="RESOLVED">Решён</option>
                        <option value="CLOSED">Закрыт</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  {activeTicket.messages.map((m) => (
                    <div key={m.id} className="rounded-2xl bg-stone-50 p-3">
                      <p className="text-xs font-semibold text-stone-700">{m.sender?.profile?.displayName ?? m.sender?.email ?? 'Участник'}</p>
                      <p className="mt-1 whitespace-pre-wrap break-words text-sm text-stone-800">{m.body}</p>
                      <p className="mt-1 text-[10px] text-stone-400">{new Date(m.createdAt).toLocaleString('ru-RU')}</p>
                    </div>
                  ))}
                  {activeTicket.messages.length === 0 && <p className="text-sm text-stone-500">Сообщений пока нет.</p>}
                </div>
                <form onSubmit={sendTicketReply} className="flex gap-2 border-t border-stone-100 p-4">
                  <input
                    value={ticketReply}
                    onChange={(e) => setTicketReply(e.target.value)}
                    placeholder="Ответить пользователю..."
                    className="field-surface min-w-0 flex-1 px-3 py-2 text-sm"
                  />
                  <button type="submit" disabled={!ticketReply.trim()} className="primary-action px-4 py-2 text-sm disabled:opacity-50">
                    Отправить
                  </button>
                </form>
              </>
            )}
          </div>
        </section>
      )}

      {tab === 'chats' && (
        <section className="grid gap-5 lg:grid-cols-[380px_1fr]">
          <div className="premium-panel overflow-hidden rounded-[2rem] p-0">
            <form onSubmit={searchChats} className="space-y-2 border-b border-stone-100 p-4">
              <h3 className="font-semibold">Переписки заказчик ↔ исполнитель</h3>
              <p className="text-xs leading-5 text-stone-500">
                Просмотр доступен только по конкретному заказу или пользователю — для разбора спора или жалобы. Введите ID заказа или ID
                пользователя.
              </p>
              <input
                value={chatSearchOrderId}
                onChange={(e) => {
                  setChatSearchOrderId(e.target.value);
                  if (e.target.value) setChatSearchUserId('');
                }}
                placeholder="ID заказа"
                className="field-surface w-full px-3 py-2 text-sm"
              />
              <input
                value={chatSearchUserId}
                onChange={(e) => {
                  setChatSearchUserId(e.target.value);
                  if (e.target.value) setChatSearchOrderId('');
                }}
                placeholder="ID пользователя"
                className="field-surface w-full px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={!chatSearchOrderId.trim() && !chatSearchUserId.trim()}
                className="primary-action w-full px-4 py-2 text-sm disabled:opacity-50"
              >
                Найти переписки
              </button>
            </form>
            <div className="max-h-[560px] divide-y divide-stone-100 overflow-y-auto">
              {chatThreads.map((t) => (
                <button
                  key={t.threadId}
                  type="button"
                  onClick={() => openChatThread(t.threadId)}
                  className={`w-full p-4 text-left transition ${activeChatThreadId === t.threadId ? 'bg-brand/10' : 'hover:bg-stone-50'}`}
                >
                  <p className="min-w-0 truncate text-sm font-semibold text-stone-900">{t.orderTitle}</p>
                  <p className="mt-0.5 truncate text-xs text-stone-500">
                    {t.client.displayName} ↔ {t.freelancer.displayName}
                  </p>
                  <p className="mt-1 text-[10px] text-stone-400">{new Date(t.lastMessageAt).toLocaleString('ru-RU')}</p>
                </button>
              ))}
              {chatSearched && chatThreads.length === 0 && <p className="p-4 text-sm text-stone-500">Переписок не найдено.</p>}
            </div>
          </div>

          <div className="premium-panel flex min-h-[500px] flex-col overflow-hidden rounded-[2rem] p-0">
            {!activeChatThread ? (
              <div className="flex flex-1 items-center justify-center p-8">
                <EmptyState
                  icon={<ChatIcon />}
                  title="Выберите переписку"
                  description="Найдите заказ или пользователя слева, затем откройте нужный тред. Просмотр только для чтения."
                />
              </div>
            ) : (
              <>
                <div className="border-b border-stone-100 p-4">
                  <h3 className="font-serif text-xl text-stone-950">{activeChatThread.orderTitle}</h3>
                  <p className="text-xs text-stone-500">
                    Заказчик: {activeChatThread.client.displayName} · Исполнитель: {activeChatThread.freelancer.displayName}
                  </p>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto p-4">
                  {activeChatThread.messages.map((m) => (
                    <div key={m.id} className="rounded-2xl bg-stone-50 p-3">
                      <p className="text-xs font-semibold text-stone-700">{m.sender?.profile?.displayName ?? m.sender?.email ?? 'Участник'}</p>
                      {m.type === 'INVOICE' && m.invoice ? (
                        <p className="mt-1 text-sm text-stone-800">Инвойс на {m.invoice.amount} — {m.invoice.status}</p>
                      ) : m.type === 'FILE' && m.file ? (
                        <a href={m.file.url} target="_blank" rel="noreferrer" className="mt-1 block text-sm text-brand underline">
                          Открыть файл
                        </a>
                      ) : (
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-stone-800">{m.body}</p>
                      )}
                      <p className="mt-1 text-[10px] text-stone-400">{new Date(m.createdAt).toLocaleString('ru-RU')}</p>
                    </div>
                  ))}
                  {activeChatThread.messages.length === 0 && <p className="text-sm text-stone-500">Сообщений пока нет.</p>}
                </div>
              </>
            )}
          </div>
        </section>
      )}

      {tab === 'moderation' && moderation && (
        <section className="space-y-5">
          <div className="premium-panel p-4 text-xs leading-5 text-stone-500">
            Сюда попадает только то, что система сама пометила как подозрительное: заказы и профили с высоким риск-скорингом
            (антифрод), и отзывы с низкой оценкой (2★ и ниже) с текстом. По каждой карточке — «Одобрить» снимает флаг без
            последствий, «Отклонить» подтверждает нарушение, «Запросить правки» просит автора исправить и не закрывает флаг.
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {[
              ['Заказы', moderation.orders.length, 'bg-card-sand'],
              ['Профили', moderation.profiles.length, 'bg-card-lavender'],
              ['Отзывы', moderation.reviews.length, 'bg-card-sage'],
            ].map(([label, value, colorClass]) => (
              <div key={label} className={`interactive-card rounded-[1.6rem] ${colorClass} p-4`}>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">{label}</p>
                <p className="mt-1 font-serif text-3xl text-stone-950">{value}</p>
              </div>
            ))}
          </div>

          <ModerationGroup title="Флаги заказов" empty="Подозрительных заказов нет">
            {moderation.orders.map((item) => (
              <ModerationCard
                key={item.id}
                title={item.order?.title ?? 'Заказ без названия'}
                eyebrow={`Заказ · риск ${SEVERITY_LABEL[item.severity] ?? item.severity} (${item.riskScore})`}
                description={item.reasons.join(', ') || 'Причина не указана'}
                meta={item.user ? `Пользователь: ${item.user.displayName}` : `Flag ${item.id}`}
                note={notesByModeration[item.id] ?? ''}
                onNote={(note) => setNotesByModeration({ ...notesByModeration, [item.id]: note })}
                onApprove={() => resolveModeration('orders', item.id, 'APPROVE')}
                onReject={() => resolveModeration('orders', item.id, 'REJECT')}
                onRequestEdits={() => resolveModeration('orders', item.id, 'REQUEST_EDITS')}
                href={item.order ? `/orders/${item.order.id}` : undefined}
              />
            ))}
          </ModerationGroup>

          <ModerationGroup title="Флаги профилей" empty="Профили чистые">
            {moderation.profiles.map((item) => (
              <ModerationCard
                key={item.id}
                title={item.user?.displayName ?? 'Профиль без имени'}
                eyebrow={`Профиль · риск ${SEVERITY_LABEL[item.severity] ?? item.severity} (${item.riskScore})`}
                description={item.reasons.join(', ') || 'Причина не указана'}
                meta={`Flag ${item.id}`}
                note={notesByModeration[item.id] ?? ''}
                onNote={(note) => setNotesByModeration({ ...notesByModeration, [item.id]: note })}
                onApprove={() => resolveModeration('profiles', item.id, 'APPROVE')}
                onReject={() => resolveModeration('profiles', item.id, 'REJECT')}
                onRequestEdits={() => resolveModeration('profiles', item.id, 'REQUEST_EDITS')}
                href={item.user ? `/freelancers/${item.user.id}` : undefined}
              />
            ))}
          </ModerationGroup>

          <ModerationGroup title="Отзывы на проверке" empty="Отзывов на проверке нет">
            {moderation.reviews.map((item) => (
              <ModerationCard
                key={item.id}
                title={`${item.rating}/5 от ${item.author.displayName}`}
                eyebrow="Отзыв"
                description={item.comment ?? 'Без текста'}
                meta={`Получатель: ${item.target.displayName}`}
                note={notesByModeration[item.id] ?? ''}
                onNote={(note) => setNotesByModeration({ ...notesByModeration, [item.id]: note })}
                onApprove={() => resolveModeration('reviews', item.id, 'APPROVE')}
                onReject={() => resolveModeration('reviews', item.id, 'REJECT')}
                onRequestEdits={() => resolveModeration('reviews', item.id, 'REQUEST_EDITS')}
              />
            ))}
          </ModerationGroup>
        </section>
      )}

      {tab === 'flags' && (
        <section className="space-y-3">
          <p className="text-xs text-stone-500">Выключатели крупных частей платформы — на случай сбоя провайдера, инцидента или поэтапного запуска новой функции.</p>
          {flags.map((flag) => {
            const meta = FEATURE_FLAG_LABEL[flag.key];
            return (
              <article key={flag.key} className="interactive-card flex items-center justify-between gap-3 rounded-2xl p-4">
                <div className="min-w-0">
                  <p className="font-semibold">{meta?.title ?? flag.key}</p>
                  {meta && <p className="mt-0.5 text-xs text-stone-500">{meta.description}</p>}
                  <p className="mt-1 text-[11px] text-stone-400">
                    Ключ: <code className="rounded bg-stone-100 px-1 py-0.5">{flag.key}</code> · раскатка на {flag.rolloutPercent}% пользователей
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2 text-sm font-medium">
                  <span>{flag.enabled ? 'Включён' : 'Выключен'}</span>
                  <Toggle
                    checked={flag.enabled}
                    onChange={(enabled) =>
                      mutate(() =>
                        api(`/admin/feature-flags/${flag.key}`, {
                          method: 'PATCH',
                          body: JSON.stringify({ enabled }),
                        }),
                      )
                    }
                  />
                </div>
              </article>
            );
          })}
          {!loading && flags.length === 0 && <EmptyState icon={<BuildIcon />} title="Флаги функций ещё не заведены" />}
        </section>
      )}

      {tab === 'commissions' && (
        <section className="space-y-3">
          {commissions.map((rule) => (
            <CommissionEditor key={rule.type} rule={rule} onSave={(percentage) => mutate(() => api(`/admin/commission-rules/${rule.type}`, {
              method: 'PATCH',
              body: JSON.stringify({ percentage }),
            }))} />
          ))}
          {!loading && commissions.length === 0 && <EmptyState icon={<ChatIcon />} title="Правила комиссии не настроены" />}
        </section>
      )}

      {tab === 'metrics' && metrics && (
        <section className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            {(
              [
                ['Выручка всего', `$${metrics.revenue.total}`, 'bg-card-sand'],
                ['Выручка в этом месяце', `$${metrics.revenue.thisMonth}`, 'bg-card-sage'],
                ['Активных споров', metrics.activeDisputes, 'bg-card-rose'],
                ['Новых юзеров за неделю', metrics.newUsersThisWeek, 'bg-card-lavender'],
              ] as const
            ).map(([label, value, colorClass]) => (
              <div key={label} className={`interactive-card rounded-2xl ${colorClass} p-4`}>
                <p className="text-xs uppercase text-stone-600">{label}</p>
                <p className="mt-1 font-serif text-xl text-stone-900">{value}</p>
              </div>
            ))}
          </div>

          <div className="premium-panel p-5">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-3">
              <h3 className="font-semibold">Динамика площадки — последние 30 дней</h3>
              <div className="flex rounded-full bg-stone-100 p-1">
                {(['money', 'activity'] as const).map((view) => (
                  <button
                    key={view}
                    type="button"
                    onClick={() => setMetricsChartView(view)}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold transition ${
                      metricsChartView === view ? 'bg-white text-brand shadow-sm' : 'text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    {view === 'money' ? 'Деньги' : 'Активность'}
                  </button>
                ))}
              </div>
            </div>
            {metricsChartView === 'money' ? (
              <>
                <p className="mb-4 text-xs text-stone-500">Выручка — комиссия площадки, GMV — общий объём оплаченных счетов.</p>
                <LineChart
                  valueFormatter={(v) => `$${v}`}
                  series={[
                    { name: 'Выручка ($)', color: '#CC785C', points: revenueTimeseries.map((p) => ({ label: p.date.slice(5), value: p.revenue })) },
                    { name: 'GMV ($)', color: '#8B9A72', points: revenueTimeseries.map((p) => ({ label: p.date.slice(5), value: p.gmv })) },
                  ]}
                />
              </>
            ) : (
              <>
                <p className="mb-4 text-xs text-stone-500">Новые регистрации и новые заказы по дням.</p>
                <LineChart
                  series={[
                    { name: 'Новых юзеров', color: '#9C98C4', points: revenueTimeseries.map((p) => ({ label: p.date.slice(5), value: p.newUsers })) },
                    { name: 'Новых заказов', color: '#C98A8A', points: revenueTimeseries.map((p) => ({ label: p.date.slice(5), value: p.newOrders })) },
                  ]}
                />
              </>
            )}
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="premium-panel p-5">
              <h3 className="mb-1 font-semibold">Воронка (когорта за 30 дней)</h3>
              <p className="mb-4 text-xs text-stone-500">Регистрация → заполнил профиль → создал заказ/откликнулся → оплатил/заработал.</p>
              {funnel && (
                <FunnelChart
                  steps={[
                    { label: 'Зарегистрировались', value: funnel.registered },
                    { label: 'Заполнили профиль', value: funnel.onboarded },
                    { label: 'Разместили заказ / откликнулись', value: funnel.postedOrRespondedFirst },
                    { label: 'Оплатили / заработали', value: funnel.paidOrEarnedFirst },
                  ]}
                />
              )}
            </div>
            <div className="premium-panel p-5">
              <h3 className="mb-3 font-semibold">Топ категорий по GMV</h3>
              <BarChart
                valueFormatter={(v) => `$${v}`}
                color="#8B9A72"
                data={topCategories.map((c) => ({ label: c.categoryName, value: c.gmv }))}
              />
            </div>
          </div>

          <div className="premium-panel p-5">
            <h3 className="mb-3 font-semibold">Топ фрилансеров по заработку</h3>
            <BarChart valueFormatter={(v) => `$${v}`} data={topFreelancers.map((f) => ({ label: f.displayName, value: f.earnings }))} />
            <div className="mt-4 divide-y divide-stone-100 text-sm">
              {topFreelancers.map((f) => (
                <div key={f.userId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <Link href={`/freelancers/${f.userId}`} className="font-medium text-stone-900 hover:text-brand">
                    {f.displayName}
                  </Link>
                  <span className="text-xs text-stone-500">
                    {f.ordersCompleted} завершённых заказов{f.avgRating !== null ? ` · рейтинг ${f.avgRating}` : ''}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="premium-panel grid gap-6 p-5 md:grid-cols-2">
            <div>
              <h3 className="mb-3 font-semibold">Заказы по статусам</h3>
              <BarChart
                height={160}
                color="#9C98C4"
                data={Object.entries(metrics.ordersByStatus).map(([status, count]) => ({ label: ORDER_STATUS_LABEL[status] ?? status, value: count }))}
              />
            </div>
            <div className="border-t border-stone-100 pt-6 md:border-l md:border-t-0 md:pl-6 md:pt-0">
              <h3 className="mb-3 font-semibold">Активные подписки по тарифам</h3>
              <BarChart
                height={160}
                color="#C98A8A"
                data={Object.entries(metrics.activeSubscriptionsByTier).map(([tier, count]) => ({ label: tier, value: count }))}
              />
            </div>
          </div>
        </section>
      )}

      {tab === 'finance' && finance && (
        <section className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {(
              [
                ['Баланс площадки (MAIN)', `$${finance.systemMainBalance}`, 'bg-card-sand'],
                ['Всего заработано (комиссии)', `$${finance.totalRevenue}`, 'bg-card-sage'],
                ['Сейчас в эскроу (у клиентов)', `$${finance.totalEscrowLocked}`, 'bg-card-lavender'],
                ['Выплачено фрилансерам (нетто)', `$${finance.totalPaidOutToFreelancers}`, 'bg-card-rose'],
                ['Оплаты подписок с баланса', `$${finance.subscriptionRevenueFromBalancePayments}`, 'bg-cream-200'],
              ] as const
            ).map(([label, value, colorClass]) => (
              <div key={label} className={`interactive-card rounded-2xl ${colorClass} p-4`}>
                <p className="text-xs uppercase text-stone-600">{label}</p>
                <p className="mt-1 font-serif text-xl text-stone-900">{value}</p>
              </div>
            ))}
          </div>
          <div className="premium-panel p-4 text-xs leading-5 text-stone-500">
            <p>
              <strong className="text-stone-700">Баланс площадки</strong> — это ledger-баланс системного счёта, не обязательно
              дословно то, что физически лежит в крипто-кошельке на NOWPayments прямо сейчас: при заявке на вывод сумма сразу
              учитывается как «зарезервировано под выплату», а обратного списания при успешной отправке крипты нет (списывается
              только при провале выплаты). Для сверки с реальным ончейн-балансом нужен отдельный webhook подтверждения выплаты от
              провайдера, которого сейчас в интеграции нет.
            </p>
            <p className="mt-2">
              <strong className="text-stone-700">Оплаты подписок с баланса</strong> — только та часть выручки по подпискам, которая
              прошла через списание с MAIN-баланса пользователя. Подписки, оплаченные криптой напрямую, не пишут проводку в
              леджер — полную картину «кто на каком тарифе» смотрите на вкладке «Подписки».
            </p>
          </div>
        </section>
      )}

      {tab === 'subscriptions' && subscriptionsData && (
        <section className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-3">
            {(['STARTER', 'PRO', 'PREMIUM'] as const).map((tierName) => (
              <div key={tierName} className="interactive-card rounded-2xl bg-card-sand p-4">
                <p className="text-xs uppercase text-stone-600">{tierName}</p>
                <p className="mt-1 font-serif text-2xl text-stone-900">{subscriptionsData.activeCountsByTierName[tierName] ?? 0}</p>
                <p className="text-[11px] text-stone-500">активных подписок</p>
              </div>
            ))}
          </div>

          <div className="premium-panel p-5">
            <h3 className="mb-3 font-semibold">Выдать подписку вручную</h3>
            <p className="mb-3 text-xs text-stone-500">
              Для поддержки/договорённостей вне платформы — например, оплата не через встроенный чекаут.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setGrantError(null);
                mutate(() =>
                  api(`/admin/subscriptions/${grantForm.userId}/grant`, {
                    method: 'POST',
                    body: JSON.stringify({ tierName: grantForm.tierName, days: Number(grantForm.days) }),
                  }),
                ).catch((err) => setGrantError(err instanceof Error ? err.message : 'Не удалось выдать подписку'));
              }}
              className="flex flex-wrap items-end gap-2"
            >
              <label className="flex flex-col text-xs text-stone-500">
                ID пользователя
                <input
                  required
                  placeholder="uuid пользователя"
                  value={grantForm.userId}
                  onChange={(e) => setGrantForm((f) => ({ ...f, userId: e.target.value }))}
                  className="field-surface mt-1 min-w-[16rem] px-3 py-2 text-sm"
                />
              </label>
              <label className="flex flex-col text-xs text-stone-500">
                Тариф
                <select
                  value={grantForm.tierName}
                  onChange={(e) => setGrantForm((f) => ({ ...f, tierName: e.target.value as 'PRO' | 'PREMIUM' }))}
                  className="field-surface mt-1 px-3 py-2 text-sm"
                >
                  <option value="PRO">PRO</option>
                  <option value="PREMIUM">PREMIUM</option>
                </select>
              </label>
              <label className="flex flex-col text-xs text-stone-500">
                Дней
                <input
                  required
                  type="number"
                  min="1"
                  value={grantForm.days}
                  onChange={(e) => setGrantForm((f) => ({ ...f, days: e.target.value }))}
                  className="field-surface mt-1 w-24 px-3 py-2 text-sm"
                />
              </label>
              <button type="submit" className="primary-action px-4 py-2 text-sm font-medium">
                Выдать
              </button>
            </form>
            {grantError && <p className="mt-2 text-sm text-red-600">{grantError}</p>}
          </div>

          <div className="premium-panel overflow-hidden p-0">
            <div className="border-b border-stone-100 p-4">
              <h3 className="font-semibold">Последние 200 подписок</h3>
            </div>
            <div className="divide-y divide-stone-100">
              {subscriptionsData.subscriptions.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                  <div>
                    <p className="font-semibold text-stone-900">{s.userDisplayName}</p>
                    <p className="text-xs text-stone-500">{s.userEmail}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-card-sage px-3 py-1 text-xs font-semibold">{s.tierName}</span>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${s.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-500'}`}>
                      {SUBSCRIPTION_STATUS_LABEL[s.status] ?? s.status}
                    </span>
                    <span className="text-xs text-stone-400">
                      {s.expiresAt ? `до ${new Date(s.expiresAt).toLocaleDateString('ru-RU')}` : '—'}
                    </span>
                    {s.status === 'ACTIVE' && (
                      <button
                        type="button"
                        onClick={() => mutate(() => api(`/admin/subscriptions/${s.userId}/revoke`, { method: 'POST' }))}
                        className="text-red-600 hover:underline"
                      >
                        Отозвать
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {subscriptionsData.subscriptions.length === 0 && (
                <p className="p-4 text-sm text-stone-500">Подписок пока не было.</p>
              )}
            </div>
          </div>
        </section>
      )}

      {tab === 'audit' && (
        <section className="premium-panel overflow-hidden p-0">
          <div className="border-b border-stone-100 p-4">
            <h3 className="font-semibold">Логи действий staff</h3>
            <p className="text-xs text-stone-500">Кто что сделал в админке и когда — бан юзера, снятие спора, изменение категорий и т.д.</p>
          </div>
          <div className="divide-y divide-stone-100">
            {auditLogs.map((log) => (
              <div key={log.id} className="flex flex-wrap items-start justify-between gap-3 p-4 text-sm">
                <div>
                  <p className="font-semibold text-stone-900">{log.action}</p>
                  <p className="text-xs text-stone-500">
                    {log.actorName} · {log.targetType}
                    {log.targetId ? ` #${log.targetId.slice(0, 8)}` : ''}
                  </p>
                </div>
                <span className="text-xs text-stone-400">{new Date(log.createdAt).toLocaleString('ru-RU')}</span>
              </div>
            ))}
            {auditLogs.length === 0 && <p className="p-4 text-sm text-stone-500">Логов пока нет.</p>}
          </div>
        </section>
      )}

      {tab === 'catalog' && (
        <section className="grid gap-6 md:grid-cols-2">
          <div className="premium-panel p-5">
            <h3 className="mb-3 font-semibold">Категории</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                mutate(() =>
                  api('/admin/categories', {
                    method: 'POST',
                    body: JSON.stringify({ name: newCategoryName, slug: slugify(newCategoryName) }),
                  }),
                );
                setNewCategoryName('');
              }}
              className="mb-3 flex gap-2"
            >
              <input
                required
                placeholder="Новая категория"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="field-surface min-w-0 flex-1 px-3 py-2 text-sm"
              />
              <button type="submit" className="primary-action px-3 py-2 text-sm font-medium">
                Добавить
              </button>
            </form>
            <div className="space-y-2">
              {categories.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-2xl border border-stone-100 bg-white p-3 text-sm shadow-sm">
                  <span>{c.name}</span>
                  <button
                    type="button"
                    onClick={() => mutate(() => api(`/admin/categories/${c.id}`, { method: 'DELETE' }))}
                    className="text-red-600 hover:underline"
                  >
                    Удалить
                  </button>
                </div>
              ))}
              {categories.length === 0 && <p className="text-sm text-stone-500">Категорий пока нет.</p>}
            </div>
          </div>

          <div className="premium-panel p-5">
            <h3 className="mb-3 font-semibold">Навыки</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                mutate(() =>
                  api('/admin/skills', {
                    method: 'POST',
                    body: JSON.stringify({ name: newSkillName, slug: slugify(newSkillName) }),
                  }),
                );
                setNewSkillName('');
              }}
              className="mb-3 flex gap-2"
            >
              <input
                required
                placeholder="Новый навык"
                value={newSkillName}
                onChange={(e) => setNewSkillName(e.target.value)}
                className="field-surface min-w-0 flex-1 px-3 py-2 text-sm"
              />
              <button type="submit" className="primary-action px-3 py-2 text-sm font-medium">
                Добавить
              </button>
            </form>
            <div className="space-y-2">
              {skills.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 rounded-2xl border border-stone-100 bg-white p-3 text-sm shadow-sm">
                  <span className="min-w-0 flex-1 truncate">{s.name}</span>
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const targetId = e.target.value;
                      if (!targetId) return;
                      const target = skills.find((sk) => sk.id === targetId);
                      if (!confirm(`Объединить «${s.name}» в «${target?.name}»? «${s.name}» будет удалён.`)) {
                        e.target.value = '';
                        return;
                      }
                      mutate(() => api(`/admin/skills/${s.id}/merge-into/${targetId}`, { method: 'POST' }));
                    }}
                    className="field-surface px-2 py-1.5 text-xs text-stone-600"
                  >
                    <option value="">Объединить с…</option>
                    {skills
                      .filter((sk) => sk.id !== s.id)
                      .map((sk) => (
                        <option key={sk.id} value={sk.id}>
                          {sk.name}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => mutate(() => api(`/admin/skills/${s.id}`, { method: 'DELETE' }))}
                    className="text-red-600 hover:underline"
                  >
                    Удалить
                  </button>
                </div>
              ))}
              {skills.length === 0 && <p className="text-sm text-stone-500">Навыков пока нет.</p>}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}

function ModerationGroup({ title, empty, children }: { title: string; empty: string; children: ReactNode }) {
  const hasItems = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <div className="premium-panel rounded-[2rem] p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-serif text-2xl text-stone-950">{title}</h3>
        <Mascot name="alertWarning" size="h-12 w-12" />
      </div>
      {hasItems ? <div className="grid gap-3">{children}</div> : <EmptyState icon={<BuildIcon />} title={empty} />}
    </div>
  );
}

function ModerationCard({
  title,
  eyebrow,
  description,
  meta,
  note,
  onNote,
  onApprove,
  onReject,
  onRequestEdits,
  href,
  approveLabel = 'Одобрить',
}: {
  title: string;
  eyebrow: string;
  description: string;
  meta: string;
  note: string;
  onNote: (note: string) => void;
  onApprove: () => void;
  onReject?: () => void;
  onRequestEdits?: () => void;
  href?: string;
  approveLabel?: string;
}) {
  return (
    <article className="interactive-card rounded-[1.75rem] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">{eyebrow}</p>
          <h4 className="mt-1 break-words font-serif text-xl text-stone-950">{title}</h4>
          <p className="mt-2 break-words text-sm leading-6 text-stone-600">{description}</p>
          <p className="mt-2 break-words text-xs font-medium text-stone-400">{meta}</p>
        </div>
        {href && (
          <Link href={href} className="secondary-action px-3 py-2 text-xs font-semibold">
            Открыть
          </Link>
        )}
      </div>
      {(onReject || onRequestEdits) && (
        <textarea
          placeholder="Заметка модератора"
          value={note}
          onChange={(e) => onNote(e.target.value)}
          className="field-surface mt-4 min-h-20 w-full px-3 py-2 text-sm"
        />
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={onApprove} className="primary-action px-3 py-2 text-sm font-semibold">
          {approveLabel}
        </button>
        {onRequestEdits && (
          <button type="button" onClick={onRequestEdits} className="secondary-action px-3 py-2 text-sm font-semibold">
            Запросить правки
          </button>
        )}
        {onReject && (
          <button type="button" onClick={onReject} className="rounded-full bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700">
            Отклонить
          </button>
        )}
      </div>
    </article>
  );
}

function CommissionEditor({ rule, onSave }: { rule: CommissionRule; onSave: (percentage: number) => void }) {
  const [percentage, setPercentage] = useState(String(rule.percentage ?? ''));

  return (
    <article className="interactive-card flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
      <div>
        <p className="font-semibold">{COMMISSION_TYPE_LABEL[rule.type] ?? rule.type}</p>
        <p className="text-sm text-stone-500">Сейчас: {rule.percentage ?? '0'}%</p>
      </div>
      <div className="flex gap-2">
        <input
          type="number"
          min="0"
          step="0.1"
          value={percentage}
          onChange={(e) => setPercentage(e.target.value)}
          className="field-surface w-28 px-3 py-2"
        />
        <button type="button" onClick={() => onSave(Number(percentage))} className="primary-action px-3 py-2 text-sm font-medium">
          Сохранить
        </button>
      </div>
    </article>
  );
}
