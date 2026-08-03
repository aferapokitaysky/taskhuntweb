'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import type { Category } from '@/lib/types';
import { AppHeader } from '@/components/AppHeader';
import { CategoryIcon } from '@/components/CategoryIcon';
import { SearchIcon } from '@/components/icons/SearchIcon';
import { Skeleton } from '@/components/Skeleton';
import { Mascot } from '@/components/Mascot';

const CATEGORY_PROMPTS = ['React лендинг', 'Telegram бот', 'Дизайн приложения', 'SEO-аудит'];

export default function CategoriesClient() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);

  useEffect(() => {
    api<Category[]>('/categories')
      .then(setCategories)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const activeCategory = useMemo(
    () => categories.find((category) => category.id === activeCategoryId) ?? categories[0],
    [activeCategoryId, categories],
  );
  const totalOpenOrders = categories.reduce((sum, category) => sum + (category.orderCount ?? 0), 0);
  const childCount = categories.reduce((sum, category) => sum + (category.children?.length ?? 0), 0);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <AppHeader />

      <section className="workspace-hero mb-8 p-6 md:p-8">
        <div className="relative grid gap-8 lg:grid-cols-[1fr_360px] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Каталог рынка</p>
            <h1 className="mt-3 max-w-3xl font-serif text-4xl leading-tight text-stone-950 md:text-6xl">Выберите направление и сразу переходите к работе</h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-stone-600">
              Категории помогают быстро понять спрос, найти исполнителей и запустить заказ без долгого блуждания по платформе.
            </p>

            <form onSubmit={submitSearch} className="mt-6 max-w-3xl">
              <div className="hero-search-shell flex flex-col gap-2 p-2 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3 rounded-[1.25rem] px-3">
                  <SearchIcon className="h-5 w-5 shrink-0 text-stone-400" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Что нужно сделать?"
                    className="min-w-0 flex-1 rounded-full border-0 bg-transparent py-3 text-sm text-stone-900 outline-none placeholder:text-stone-400 focus:border-transparent focus:ring-0"
                  />
                </div>
                <button type="submit" className="primary-action shrink-0 px-5 py-3 text-sm">
                  Найти
                </button>
              </div>
            </form>

            <div className="mt-4 flex flex-wrap gap-2">
              {CATEGORY_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => {
                    setQuery(prompt);
                    router.push(`/search?q=${encodeURIComponent(prompt)}`);
                  }}
                  className="rounded-full border border-stone-200 bg-white/70 px-3 py-1.5 text-xs font-semibold text-stone-600 transition hover:border-brand/30 hover:text-brand"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-stone-100 bg-white/65 p-4 shadow-sm backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">Навигация по рынку</p>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="hero-stat p-3">
                <p className="font-serif text-3xl text-stone-950">{categories.length}</p>
                <p className="text-[11px] uppercase text-stone-400">категорий</p>
              </div>
              <div className="hero-stat p-3">
                <p className="font-serif text-3xl text-stone-950">{childCount}</p>
                <p className="text-[11px] uppercase text-stone-400">ниш</p>
              </div>
              <div className="hero-stat p-3">
                <p className="font-serif text-3xl text-stone-950">{totalOpenOrders}</p>
                <p className="text-[11px] uppercase text-stone-400">заказов</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-8 grid gap-4 lg:grid-cols-3">
        {[
          { title: 'Найти исполнителя', text: 'Сравните профили, навыки и портфолио в нужной нише.', href: '/freelancers', mascot: 'supportHeadset' as const, tone: 'bg-card-lavender/60' },
          { title: 'Опубликовать задачу', text: 'Опишите работу, бюджет и получите отклики от подходящих специалистов.', href: '/register?role=CLIENT', mascot: 'workLaptop' as const, tone: 'bg-card-sand/70' },
          { title: 'Искать заказы', text: 'Фрилансеры могут перейти в поиск и сохранить фильтр под свой стек.', href: '/search?type=orders', mascot: 'magnifierPro' as const, tone: 'bg-card-sage/65' },
        ].map(({ title, text, href, mascot, tone }) => (
          <Link key={title} href={href} className="interactive-card overflow-hidden rounded-[2rem] p-5">
            <div className={`flex h-28 items-center justify-center rounded-[1.6rem] ${tone}`}>
              <div className="flex h-24 w-24 items-center justify-center rounded-[1.45rem] bg-white/45">
                <Mascot name={mascot} size="h-24 w-24" />
              </div>
            </div>
            <h2 className="mt-4 font-serif text-xl text-stone-950">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-stone-600">{text}</p>
          </Link>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <aside className="premium-panel h-fit rounded-[2rem] p-4 lg:sticky lg:top-6">
          <div className="mb-3 flex items-center justify-between gap-3 rounded-[1.5rem] bg-card-sand/45 px-3 py-3">
            <div>
              <p className="text-xs font-semibold uppercase text-stone-400">Направления</p>
              <p className="mt-1 text-sm font-medium text-stone-700">{categories.length || '...'} категорий</p>
            </div>
            <Mascot name="qualityChecklist" size="h-12 w-12" />
          </div>
          <div className="space-y-1">
            {loading
              ? Array.from({ length: 7 }).map((_, index) => <Skeleton key={index} className="h-12 rounded-2xl" />)
              : categories.map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => setActiveCategoryId(category.id)}
                    className={`flex w-full items-center justify-between gap-3 rounded-[1.35rem] px-3 py-3 text-left text-sm font-semibold transition ${
                      activeCategory?.id === category.id ? 'bg-brand text-white shadow-sm' : 'text-stone-650 hover:bg-stone-100 hover:text-stone-950'
                    }`}
                  >
                    <span className="truncate">{category.name}</span>
                    <span className={activeCategory?.id === category.id ? 'text-white/75' : 'text-stone-400'}>
                      {category.orderCount ?? 0}
                    </span>
                  </button>
                ))}
          </div>
        </aside>

        <section className="min-w-0">
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="premium-panel p-5">
                  <Skeleton className="h-16 w-16 rounded-3xl" />
                  <Skeleton className="mt-5 h-6 w-2/3" />
                  <Skeleton className="mt-2 h-4 w-full" />
                  <Skeleton className="mt-5 h-10 rounded-2xl" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {activeCategory && (
                <div className="premium-panel mb-4 overflow-hidden rounded-[2rem] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-5 rounded-[1.6rem] bg-gradient-to-br from-card-sand/55 via-white/70 to-card-sage/45 p-4">
                    <div className="flex items-start gap-4">
                      <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[1.5rem] bg-cream-100 shadow-sm">
                        <CategoryIcon slug={activeCategory.slug} className="h-20 w-20" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold uppercase text-stone-400">Выбранное направление</p>
                        <h2 className="mt-1 font-serif text-3xl text-stone-950">{activeCategory.name}</h2>
                        <p className="mt-2 max-w-xl text-sm leading-6 text-stone-600">
                          Откройте витрину категории, посмотрите открытые задачи или перейдите к специалистам с релевантными навыками.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Link href={`/categories/${activeCategory.id}`} className="primary-action px-4 py-2.5 text-sm">
                        Открыть
                      </Link>
                      <Link href={`/freelancers?categoryId=${activeCategory.id}`} className="secondary-action px-4 py-2.5 text-sm">
                        Фрилансеры
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {categories.map((category) => (
                  <Link key={category.id} href={`/categories/${category.id}`} className="interactive-card group rounded-3xl p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-3xl bg-cream-100 transition group-hover:scale-105">
                        <CategoryIcon slug={category.slug} className="h-16 w-16" />
                      </div>
                      <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-500">
                        {category.orderCount ?? 0} задач
                      </span>
                    </div>
                    <h3 className="mt-5 font-serif text-xl text-stone-950">{category.name}</h3>
                    <p className="mt-2 text-sm text-stone-500">{category.children?.length ?? 0} подкатегорий</p>
                    {category.children && category.children.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {category.children.slice(0, 4).map((child) => (
                          <span key={child.id} className="rounded-full bg-card-sand px-2.5 py-1 text-xs font-medium text-stone-700">
                            {child.name}
                          </span>
                        ))}
                      </div>
                    )}
                    <span className="mt-5 inline-flex text-sm font-semibold text-brand">Открыть рынок</span>
                  </Link>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
