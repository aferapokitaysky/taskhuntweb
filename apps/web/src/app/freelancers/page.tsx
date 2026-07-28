'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Category, Skill } from '@/lib/types';
import { TierBadge } from '@/components/TierBadge';

interface FreelancerListItem {
  id: string;
  profile: {
    displayName: string;
    bio?: string | null;
    country?: string | null;
    city?: string | null;
    successRate?: string | null;
    skills: { id: string; name: string }[];
  };
  subscriptionTier: 'STARTER' | 'PRO' | 'PREMIUM';
}

export default function FreelancersPage() {
  const [freelancers, setFreelancers] = useState<FreelancerListItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [skillId, setSkillId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const flatCategories = categories.flatMap((c) => [c, ...(c.children ?? [])]);

  useEffect(() => {
    Promise.all([api<Category[]>('/categories'), api<Skill[]>('/skills')])
      .then(([cats, sk]) => {
        setCategories(cats);
        setSkills(sk);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (categoryId) params.set('categoryId', categoryId);
    if (skillId) params.set('skillId', skillId);

    setLoading(true);
    const timeout = setTimeout(() => {
      api<FreelancerListItem[]>(`/freelancers?${params.toString()}`)
        .then(setFreelancers)
        .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить список'))
        .finally(() => setLoading(false));
    }, 300); // дебаунс поиска

    return () => clearTimeout(timeout);
  }, [search, categoryId, skillId]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <Link href="/dashboard" className="mb-6 inline-block text-sm font-medium text-slate-500 hover:text-slate-900">
        ← Назад в dashboard
      </Link>
      <h1 className="mb-6 text-2xl font-bold">Фрилансеры</h1>

      <div className="mb-6 flex flex-wrap gap-3">
        <input
          placeholder="Поиск по имени или описанию"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-4 py-2"
        />
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="rounded-lg border border-slate-300 px-4 py-2"
        >
          <option value="">Все категории</option>
          {flatCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={skillId}
          onChange={(e) => setSkillId(e.target.value)}
          className="rounded-lg border border-slate-300 px-4 py-2"
        >
          <option value="">Все навыки</option>
          {skills.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {loading ? (
        <p className="text-slate-500">Загружаем…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {freelancers.map((f) => (
            <Link
              key={f.id}
              href={`/freelancers/${f.id}`}
              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand"
            >
              <div className="flex items-center gap-2">
                <p className="font-semibold">{f.profile.displayName}</p>
                <TierBadge tier={f.subscriptionTier} />
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {[f.profile.city, f.profile.country].filter(Boolean).join(', ') || 'Локация не указана'}
              </p>
              {f.profile.bio && <p className="mt-2 line-clamp-2 text-sm text-slate-600">{f.profile.bio}</p>}
              <div className="mt-3 flex flex-wrap gap-1">
                {f.profile.skills.slice(0, 4).map((skill) => (
                  <span key={skill.id} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {skill.name}
                  </span>
                ))}
              </div>
            </Link>
          ))}
          {freelancers.length === 0 && <p className="text-sm text-slate-500">Никого не найдено.</p>}
        </div>
      )}
    </main>
  );
}
