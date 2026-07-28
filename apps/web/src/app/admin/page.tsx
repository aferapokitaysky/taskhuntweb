'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Category, CommissionRule, Dispute, FeatureFlag, Skill, User } from '@/lib/types';

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
        <Link href="/dashboard" className="text-sm font-medium text-slate-500 hover:text-slate-900">
          Dashboard
        </Link>
        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold">Admin</h1>
          <p className="mt-2 text-slate-600">Для этого раздела нужен staff-доступ.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">TaskHunt</p>
          <h1 className="text-3xl font-bold">Admin</h1>
        </div>
        <Link href="/dashboard" className="rounded-lg border border-slate-300 px-4 py-2 font-medium hover:bg-white">
          Dashboard
        </Link>
      </header>

      <div className="mb-6 flex flex-wrap gap-2">
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
            className={`rounded-lg border px-4 py-2 text-sm font-medium ${
              tab === key ? 'border-brand bg-indigo-50 text-brand' : 'border-slate-300 bg-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {loading && <p className="text-slate-500">Загружаем...</p>}

      {tab === 'users' && (
        <section className="space-y-3">
          {users.map((user) => (
            <article key={user.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div>
                <p className="font-semibold">{user.profile?.displayName ?? user.email}</p>
                <p className="text-sm text-slate-500">{user.email}</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => mutate(() => api(`/admin/users/${user.id}/suspend`, { method: 'POST' }))}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium"
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
        </section>
      )}

      {tab === 'disputes' && (
        <section className="space-y-3">
          {disputes.map((dispute) => (
            <article key={dispute.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <p className="font-semibold">Order {dispute.orderId}</p>
                  <p className="text-sm text-slate-600">{dispute.reason}</p>
                </div>
                <span className="text-sm text-slate-500">{dispute.status}</span>
              </div>
              <textarea
                placeholder="Resolution notes"
                value={notesByDispute[dispute.id] ?? ''}
                onChange={(e) => setNotesByDispute({ ...notesByDispute, [dispute.id]: e.target.value })}
                className="mt-4 min-h-20 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => mutate(() => api(`/admin/disputes/${dispute.id}/assign`, { method: 'PATCH' }))}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium"
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
                  className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white"
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
                  className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white"
                >
                  Freelancer wins
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      {tab === 'flags' && (
        <section className="space-y-3">
          {flags.map((flag) => (
            <article key={flag.key} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <div>
                <p className="font-semibold">{flag.key}</p>
                <p className="text-sm text-slate-500">Rollout {flag.rolloutPercent}%</p>
              </div>
              <label className="flex items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={flag.enabled}
                  onChange={(e) =>
                    mutate(() =>
                      api(`/admin/feature-flags/${flag.key}`, {
                        method: 'PATCH',
                        body: JSON.stringify({ enabled: e.target.checked }),
                      }),
                    )
                  }
                />
                Enabled
              </label>
            </article>
          ))}
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
        </section>
      )}

      {tab === 'metrics' && metrics && (
        <section className="space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            {[
              ['Выручка всего', `$${metrics.revenue.total}`],
              ['Выручка в этом месяце', `$${metrics.revenue.thisMonth}`],
              ['Активных споров', metrics.activeDisputes],
              ['Новых юзеров за неделю', metrics.newUsersThisWeek],
            ].map(([label, value]) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs uppercase text-slate-500">{label}</p>
                <p className="mt-1 text-xl font-semibold">{value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 font-semibold">Заказы по статусам</h3>
              <div className="space-y-1 text-sm">
                {Object.entries(metrics.ordersByStatus).map(([status, count]) => (
                  <div key={status} className="flex justify-between">
                    <span className="text-slate-600">{status}</span>
                    <span className="font-medium">{count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 font-semibold">Активные подписки по тирам</h3>
              <div className="space-y-1 text-sm">
                {Object.entries(metrics.activeSubscriptionsByTier).map(([tier, count]) => (
                  <div key={tier} className="flex justify-between">
                    <span className="text-slate-600">{tier}</span>
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
          <div>
            <h3 className="mb-3 font-semibold">Категории</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                mutate(() => api('/admin/categories', { method: 'POST', body: JSON.stringify({ name: newCategoryName } ) }));
                setNewCategoryName('');
              }}
              className="mb-3 flex gap-2"
            >
              <input
                required
                placeholder="Новая категория"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <button type="submit" className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white">
                Добавить
              </button>
            </form>
            <div className="space-y-2">
              {categories.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 text-sm">
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
            </div>
          </div>

          <div>
            <h3 className="mb-3 font-semibold">Навыки</h3>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                mutate(() => api('/admin/skills', { method: 'POST', body: JSON.stringify({ name: newSkillName }) }));
                setNewSkillName('');
              }}
              className="mb-3 flex gap-2"
            >
              <input
                required
                placeholder="Новый навык"
                value={newSkillName}
                onChange={(e) => setNewSkillName(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <button type="submit" className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white">
                Добавить
              </button>
            </form>
            <div className="space-y-2">
              {skills.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 text-sm">
                  <span>{s.name}</span>
                  <button
                    type="button"
                    onClick={() => mutate(() => api(`/admin/skills/${s.id}`, { method: 'DELETE' }))}
                    className="text-red-600 hover:underline"
                  >
                    Удалить
                  </button>
                </div>
              ))}
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
    <article className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <p className="font-semibold">{rule.type}</p>
        <p className="text-sm text-slate-500">Current: {rule.percentage ?? '0'}%</p>
      </div>
      <div className="flex gap-2">
        <input
          type="number"
          min="0"
          step="0.1"
          value={percentage}
          onChange={(e) => setPercentage(e.target.value)}
          className="w-28 rounded-lg border border-slate-300 px-3 py-2"
        />
        <button type="button" onClick={() => onSave(Number(percentage))} className="rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white">
          Save
        </button>
      </div>
    </article>
  );
}
