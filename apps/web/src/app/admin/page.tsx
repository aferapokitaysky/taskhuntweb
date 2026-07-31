'use client';

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

type Tab = 'users' | 'disputes' | 'flags' | 'commissions' | 'catalog' | 'metrics';

interface AdminMetrics {
  revenue: { total: number; thisMonth: number };
  activeDisputes: number;
  ordersByStatus: Record<string, number>;
  newUsersThisWeek: number;
  activeSubscriptionsByTier: Record<string, number>;
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
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newSkillName, setNewSkillName] = useState('');
  const [notesByDispute, setNotesByDispute] = useState<Record<string, string>>({});
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
      if (tab === 'catalog') {
        setCategories(await api<Category[]>('/categories'));
        setSkills(await api<Skill[]>('/skills'));
      }
      if (tab === 'metrics') setMetrics(await api<AdminMetrics>('/admin/metrics'));
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
                <p className="font-serif text-2xl text-stone-950">{flags.length}</p>
                <p className="text-[11px] uppercase text-stone-400">flags</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="premium-panel mb-6 flex flex-wrap items-center gap-2 p-2">
        {[
          ['metrics', 'Метрики'],
          ['users', 'Users'],
          ['disputes', 'Disputes'],
          ['flags', 'Feature Flags'],
          ['commissions', 'Commissions'],
          ['catalog', 'Категории и навыки'],
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
