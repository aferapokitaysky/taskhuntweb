'use client';

import Link from 'next/link';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import type { Category, Skill } from '@/lib/types';
import { AppHeader } from '@/components/AppHeader';
import { EmptyState } from '@/components/EmptyState';
import { FreelancerCard, type FreelancerListItem } from '@/components/FreelancerCard';
import { FreelancerCardSkeleton } from '@/components/Skeleton';
import { EmptySearchIcon } from '@/components/icons/illustrated/EmptySearchIcon';
import { FreelancerIcon } from '@/components/icons/illustrated/FreelancerIcon';
import { MatchIcon } from '@/components/icons/illustrated/MatchIcon';
import { SearchIcon } from '@/components/icons/SearchIcon';
import { TalentSearchIcon } from '@/components/icons/illustrated/TalentSearchIcon';
import { TalentShieldIcon } from '@/components/icons/illustrated/TalentShieldIcon';

function FreelancersPageContent() {
  const searchParams = useSearchParams();
  const [freelancers, setFreelancers] = useState<FreelancerListItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState(searchParams.get('categoryId') ?? '');
  const [skillId, setSkillId] = useState(searchParams.get('skillId') ?? '');
  const [sortBy, setSortBy] = useState<'default' | 'rating' | 'activity'>('default');
  const [loading, setLoading] = useState(true);

  const flatCategories = categories.flatMap((category) => [category, ...(category.children ?? [])]);

  useEffect(() => {
    Promise.all([api<Category[]>('/categories'), api<Skill[]>('/skills')])
      .then(([categoryList, skillList]) => {
        setCategories(categoryList);
        setSkills(skillList);
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
        .catch(() => setFreelancers([]))
        .finally(() => setLoading(false));
    }, 300);

    return () => clearTimeout(timeout);
  }, [search, categoryId, skillId]);

  const activeCategoryName = categoryId ? flatCategories.find((category) => category.id === categoryId)?.name : null;
  const activeSkillName = skillId ? skills.find((skill) => skill.id === skillId)?.name : null;
  const topRatedCount = freelancers.filter((freelancer) => freelancer.level === 'TOP_RATED').length;
  const availableCount = freelancers.length;

  const sortedFreelancers = useMemo(() => {
    if (sortBy === 'default') return freelancers;
    const list = [...freelancers];
    if (sortBy === 'rating') {
      list.sort((a, b) => Number(b.profile.successRate ?? 0) - Number(a.profile.successRate ?? 0));
    } else {
      const rank: Record<string, number> = { TOP_RATED: 2, RISING_TALENT: 1 };
      list.sort((a, b) => (rank[b.level ?? ''] ?? 0) - (rank[a.level ?? ''] ?? 0));
    }
    return list;
  }, [freelancers, sortBy]);

  function resetFilters() {
    setSearch('');
    setCategoryId('');
    setSkillId('');
    setSortBy('default');
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <AppHeader />

      <section className="workspace-hero mb-8 p-6 md:p-8">
        <div className="relative grid gap-8 lg:grid-cols-[1fr_360px] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Подбор исполнителей</p>
            <h1 className="mt-3 max-w-3xl font-serif text-4xl leading-tight text-stone-950 md:text-6xl">Найдите специалиста под задачу, а не просто профиль</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-stone-600">
              Фильтруйте по направлению, навыкам и качеству профиля. TaskHunt держит рядом портфолио, доверие, рейтинг и быстрый путь к приглашению.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link href="/dashboard#create-order" className="primary-action px-5 py-3 text-sm">
                Создать заказ
              </Link>
              <Link href="/search?type=orders" className="secondary-action px-5 py-3 text-sm">
                Смотреть заказы
              </Link>
            </div>
          </div>

          <div className="rounded-3xl border border-stone-100 bg-white/65 p-4 shadow-sm backdrop-blur">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">Пул специалистов</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="font-serif text-3xl text-stone-950">{freelancers.length}</p>
                <p className="text-[11px] uppercase text-stone-400">в выдаче</p>
              </div>
              <div>
                <p className="font-serif text-3xl text-stone-950">{availableCount}</p>
                <p className="text-[11px] uppercase text-stone-400">доступны</p>
              </div>
              <div>
                <p className="font-serif text-3xl text-stone-950">{topRatedCount}</p>
                <p className="text-[11px] uppercase text-stone-400">top</p>
              </div>
            </div>
            <div className="mt-4 rounded-2xl bg-card-sand/70 p-3 text-sm text-stone-700">
              {activeSkillName || activeCategoryName ? (
                <span>
                  Сейчас: {[activeCategoryName, activeSkillName].filter(Boolean).join(' · ')}
                </span>
              ) : (
                <span>Выберите направление или навык, чтобы сузить подбор.</span>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="mb-8 grid gap-4 lg:grid-cols-3">
        {[
          { title: 'Проверяйте профиль', text: 'Портфолио, навыки, история и открытость к заказам видны до контакта.', Icon: FreelancerIcon },
          { title: 'Сужайте подбор', text: 'Категория и навык дают более чистую выдачу без лишних карточек.', Icon: TalentSearchIcon },
          { title: 'Работайте через эскроу', text: 'После выбора исполнителя оплата и этапы остаются в защищенном процессе.', Icon: TalentShieldIcon },
        ].map(({ title, text, Icon }) => (
          <div key={title} className="interactive-card rounded-3xl p-5">
            <div className="flex items-start justify-between gap-3">
              <Icon className="h-12 w-12" />
            </div>
            <h2 className="mt-4 font-serif text-xl text-stone-950">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">{text}</p>
          </div>
        ))}
      </section>

      <section className="premium-panel mb-6 p-3">
        <div className="grid gap-2 lg:grid-cols-[1fr_220px_220px_auto]">
          <div className="field-surface flex items-center gap-3 px-4 py-2">
            <SearchIcon className="h-5 w-5 shrink-0 text-stone-400" />
            <input
              placeholder="Имя, специализация, описание"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="field-surface px-4 py-2 text-sm">
            <option value="">Все категории</option>
            {flatCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <select value={skillId} onChange={(e) => setSkillId(e.target.value)} className="field-surface px-4 py-2 text-sm">
            <option value="">Все навыки</option>
            {skills.map((skill) => (
              <option key={skill.id} value={skill.id}>
                {skill.name}
              </option>
            ))}
          </select>
          <button type="button" onClick={resetFilters} className="secondary-action px-4 py-2 text-sm">
            Сбросить
          </button>
        </div>
      </section>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['default', 'Релевантность'],
              ['rating', 'Успешность'],
              ['activity', 'Уровень'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setSortBy(value)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                sortBy === value ? 'bg-brand text-white shadow-sm' : 'bg-white text-stone-600 hover:bg-stone-100 hover:text-stone-950'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-sm text-stone-500">{loading ? 'Ищем специалистов…' : `${sortedFreelancers.length} профилей`}</p>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <FreelancerCardSkeleton key={index} />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sortedFreelancers.map((freelancer) => (
            <FreelancerCard key={freelancer.id} freelancer={freelancer} />
          ))}
          {freelancers.length === 0 && (
            <div className="md:col-span-2">
              <EmptyState
                icon={<EmptySearchIcon />}
                title="Никого не найдено"
                description="Попробуйте изменить поиск, категорию или навык."
              />
            </div>
          )}
        </div>
      )}

      {!loading && freelancers.length > 0 && (
        <section className="mt-8 rounded-3xl bg-card-sand p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <MatchIcon className="h-14 w-14" />
              <div>
                <h2 className="font-serif text-2xl text-stone-950">Не хотите выбирать вручную?</h2>
                <p className="mt-1 text-sm text-stone-600">Опубликуйте заказ, и подходящие специалисты сами придут с откликами.</p>
              </div>
            </div>
            <Link href="/dashboard#create-order" className="primary-action px-5 py-3 text-sm">
              Опубликовать задачу
            </Link>
          </div>
        </section>
      )}
    </main>
  );
}

export default function FreelancersClient() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-7xl px-4 py-8 text-stone-500">Загружаем фрилансеров…</main>}>
      <FreelancersPageContent />
    </Suspense>
  );
}
