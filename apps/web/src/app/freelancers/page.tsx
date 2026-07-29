'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import type { Category, Skill } from '@/lib/types';
import { AppHeader } from '@/components/AppHeader';
import { EmptyState } from '@/components/EmptyState';
import { EmptySearchIcon } from '@/components/icons/illustrated/EmptySearchIcon';
import { FreelancerCard, type FreelancerListItem } from '@/components/FreelancerCard';

function FreelancersPageContent() {
  const searchParams = useSearchParams();
  const [freelancers, setFreelancers] = useState<FreelancerListItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [skillId, setSkillId] = useState(searchParams.get('skillId') ?? '');
  const [loading, setLoading] = useState(true);

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
        .catch(() => setFreelancers([])) // сбой загрузки списка — просто пустой список с иллюстрацией, без тревожного баннера
        .finally(() => setLoading(false));
    }, 300); // дебаунс поиска

    return () => clearTimeout(timeout);
  }, [search, categoryId, skillId]);

  const activeSkillName = skillId ? skills.find((s) => s.id === skillId)?.name : null;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <AppHeader />
      <h1 className="mb-6 font-serif text-3xl text-stone-900">Фрилансеры</h1>

      {activeSkillName && (
        <p className="mb-4 -mt-4 text-sm text-stone-500">
          Фильтр по навыку: <span className="font-medium text-brand">{activeSkillName}</span>{' '}
          <button type="button" onClick={() => setSkillId('')} className="text-stone-400 hover:text-stone-600">
            × сбросить
          </button>
        </p>
      )}

      <div className="mb-6 flex flex-wrap gap-3 rounded-2xl bg-white p-3 shadow-sm">
        <input
          placeholder="Поиск по имени или описанию"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-stone-200 px-4 py-2 focus:border-brand focus:outline-none"
        />
        <select
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          className="rounded-lg border border-stone-200 px-4 py-2"
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
          className="rounded-lg border border-stone-200 px-4 py-2"
        >
          <option value="">Все навыки</option>
          {skills.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-stone-500">Загружаем…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {freelancers.map((freelancer) => (
            <FreelancerCard key={freelancer.id} freelancer={freelancer} />
          ))}
          {freelancers.length === 0 && (
            <div className="sm:col-span-2">
              <EmptyState
                icon={<EmptySearchIcon />}
                title="Никого не найдено"
                description="Попробуйте изменить поиск или сбросить фильтры по категории и навыку."
              />
            </div>
          )}
        </div>
      )}
    </main>
  );
}

export default function FreelancersPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-6xl px-4 py-8 text-stone-500">Загружаем…</main>}>
      <FreelancersPageContent />
    </Suspense>
  );
}
