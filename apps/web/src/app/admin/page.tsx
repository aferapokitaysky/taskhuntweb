'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Toggle } from '@/components/Toggle';
import { AppHeader } from '@/components/AppHeader';
import { ErrorNotice } from '@/components/ErrorNotice';
import { EmptyState } from '@/components/EmptyState';
import { MatchIcon } from '@/components/icons/illustrated/MatchIcon';
import { ChatIcon } from '@/components/icons/illustrated/ChatIcon';
import { EscrowIcon } from '@/components/icons/illustrated/EscrowIcon';
import { BuildIcon } from '@/components/icons/illustrated/BuildIcon';
import { Mascot } from '@/components/Mascot';
import type { Category, CommissionRule, Dispute, FeatureFlag, Skill, User } from '@/lib/types';

// Category.slug/Skill.slug обязательны и уникальны на бэке — генерируем
// сами, чтобы не заставлять staff придумывать slug руками в форме.
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '');
}

type Tab = 'users' | 'disputes' | 'moderation' | 'flags' | 'commissions' | 'catalog' | 'metrics' | 'finance' | 'subscriptions' | 'audit';

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
  files: Array<{
    type: 'FILE';
    id: string;
    url: string;
    mimeType: string;
    kind: string;
    owner: { id: string; displayName: string };
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
  }, [me, tab]);

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
      if (tab === 'metrics') setMetrics(await api<AdminMetrics>('/admin/metrics'));
      if (tab === 'finance') setFinance(await api<FinanceOverview>('/admin/finance/overview'));
      if (tab === 'subscriptions') setSubscriptionsData(await api<SubscriptionsResponse>('/admin/subscriptions'));
      if (tab === 'audit') setAuditLogs((await api<AuditLogsResponse>('/admin/audit-logs')).items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить данные');
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

  async function resolveModeration(kind: 'orders' | 'profiles' | 'files' | 'reviews', id: string, action: ModerationAction = 'APPROVE') {
    const note = notesByModeration[id];
    const body = kind === 'files' ? undefined : JSON.stringify({ action, note });
    await mutate(() =>
      api(`/admin/moderation-queue/${kind}/${id}`, {
        method: 'PATCH',
        body,
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
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Staff console</p>
            <h1 className="mt-3 font-serif text-3xl leading-tight text-stone-950 md:text-5xl">Пульт качества маркетплейса</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-stone-600">
              Метрики, споры, пользователи, комиссии и каталог собраны в одном рабочем контуре для быстрых решений команды.
            </p>
          </div>
          <div className="rounded-3xl border border-stone-100 bg-white/65 p-4 shadow-sm backdrop-blur">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">Staff pulse</p>
              <Mascot name="workLaptop" size="h-14 w-14" />
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="hero-stat p-3">
                <p className="font-serif text-2xl text-stone-950">{users.length}</p>
                <p className="text-[11px] uppercase text-stone-400">users</p>
              </div>
              <div className="hero-stat p-3">
                <p className="font-serif text-2xl text-stone-950">{disputes.length}</p>
                <p className="text-[11px] uppercase text-stone-400">disputes</p>
              </div>
              <div className="hero-stat p-3">
                <p className="font-serif text-2xl text-stone-950">
                  {moderation ? moderation.orders.length + moderation.profiles.length + moderation.files.length + moderation.reviews.length : flags.length}
                </p>
                <p className="text-[11px] uppercase text-stone-400">queue</p>
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
          ['users', 'Users'],
          ['disputes', 'Disputes'],
          ['moderation', 'Moderation'],
          ['flags', 'Feature Flags'],
          ['commissions', 'Commissions'],
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
          {users.map((user) => (
            <article key={user.id} className="interactive-card flex flex-wrap items-center justify-between gap-3 rounded-2xl p-4">
              <div>
                <p className="font-semibold">{user.profile?.displayName ?? user.email}</p>
                <p className="text-sm text-stone-500">{user.email}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => mutate(() => api(`/admin/users/${user.id}/suspend`, { method: 'POST' }))}
                  className="secondary-action px-3 py-2 text-sm font-medium"
                >
                  Suspend
                </button>
                <button
                  type="button"
                  onClick={() => mutate(() => api(`/admin/users/${user.id}/ban`, { method: 'POST' }))}
                  className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white"
                >
                  Ban
                </button>
              </div>
            </article>
          ))}
          {!loading && users.length === 0 && <EmptyState icon={<MatchIcon />} title="Пользователей пока нет" />}
        </section>
      )}

      {tab === 'disputes' && (
        <section className="space-y-3">
          {disputes.map((dispute) => (
            <article key={dispute.id} className="interactive-card rounded-2xl p-4">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <p className="font-semibold">Order {dispute.orderId}</p>
                  <p className="text-sm text-stone-600">{dispute.reason}</p>
                </div>
                <span className="text-sm text-stone-500">{dispute.status}</span>
              </div>
              <textarea
                placeholder="Resolution notes"
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
                  Assign to me
                </button>
                <button
                  type="button"
                  onClick={() =>
                    mutate(() =>
                      api(`/admin/disputes/${dispute.id}/resolve`, {
                        method: 'PATCH',
                        body: JSON.stringify({ resolution: 'RESOLVED_CLIENT', notes: notesByDispute[dispute.id] }),
                      }),
                    )
                  }
                  className="rounded-lg bg-stone-900 px-3 py-2 text-sm font-medium text-white"
                >
                  Client wins
                </button>
                <button
                  type="button"
                  onClick={() =>
                    mutate(() =>
                      api(`/admin/disputes/${dispute.id}/resolve`, {
                        method: 'PATCH',
                        body: JSON.stringify({ resolution: 'RESOLVED_FREELANCER', notes: notesByDispute[dispute.id] }),
                      }),
                    )
                  }
                  className="primary-action px-3 py-2 text-sm font-medium"
                >
                  Freelancer wins
                </button>
              </div>
            </article>
          ))}
          {!loading && disputes.length === 0 && <EmptyState icon={<EscrowIcon />} title="Активных споров нет" />}
        </section>
      )}

      {tab === 'moderation' && moderation && (
        <section className="space-y-5">
          <div className="grid gap-3 md:grid-cols-4">
            {[
              ['Заказы', moderation.orders.length, 'bg-card-sand'],
              ['Профили', moderation.profiles.length, 'bg-card-lavender'],
              ['Файлы', moderation.files.length, 'bg-card-rose'],
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
                eyebrow={`ORDER / ${item.severity} / риск ${item.riskScore}`}
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
                eyebrow={`PROFILE / ${item.severity} / риск ${item.riskScore}`}
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

          <ModerationGroup title="Файлы после сканирования" empty="Заражённых файлов нет">
            {moderation.files.map((item) => (
              <ModerationCard
                key={item.id}
                title={item.kind}
                eyebrow={`FILE / ${item.mimeType}`}
                description={item.url}
                meta={`Владелец: ${item.owner.displayName}`}
                note=""
                onNote={() => undefined}
                onApprove={() => resolveModeration('files', item.id)}
                approveLabel="Снять с очереди"
              />
            ))}
          </ModerationGroup>

          <ModerationGroup title="Отзывы на проверке" empty="Отзывов на проверке нет">
            {moderation.reviews.map((item) => (
              <ModerationCard
                key={item.id}
                title={`${item.rating}/5 от ${item.author.displayName}`}
                eyebrow="REVIEW"
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
          {flags.map((flag) => (
            <article key={flag.key} className="interactive-card flex items-center justify-between gap-3 rounded-2xl p-4">
              <div>
                <p className="font-semibold">{flag.key}</p>
                <p className="text-sm text-stone-500">Rollout {flag.rolloutPercent}%</p>
              </div>
              <div className="flex items-center gap-2 text-sm font-medium">
                <span>Enabled</span>
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
          ))}
          {!loading && flags.length === 0 && <EmptyState icon={<BuildIcon />} title="Feature flags ещё не заведены" />}
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

          <div className="grid gap-6 md:grid-cols-2">
            <div className="premium-panel p-4">
              <h3 className="mb-3 font-semibold">Заказы по статусам</h3>
              <div className="space-y-1 text-sm">
                {Object.entries(metrics.ordersByStatus).map(([status, count]) => (
                  <div key={status} className="flex justify-between">
                    <span className="text-stone-600">{status}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="premium-panel p-4">
              <h3 className="mb-3 font-semibold">Активные подписки по тирам</h3>
              <div className="space-y-1 text-sm">
                {Object.entries(metrics.activeSubscriptionsByTier).map(([tier, count]) => (
                  <div key={tier} className="flex justify-between">
                    <span className="text-stone-600">{tier}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
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
                      {s.status}
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
  approveLabel = 'Approve',
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
            Request edits
          </button>
        )}
        {onReject && (
          <button type="button" onClick={onReject} className="rounded-full bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700">
            Reject
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
        <p className="font-semibold">{rule.type}</p>
        <p className="text-sm text-stone-500">Current: {rule.percentage ?? '0'}%</p>
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
          Save
        </button>
      </div>
    </article>
  );
}
