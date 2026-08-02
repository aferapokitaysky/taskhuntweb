'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Category, Order, PaginatedOrders, User } from '@/lib/types';
import { money } from '@/lib/types';
import { AppHeader } from '@/components/AppHeader';
import { EmptyState } from '@/components/EmptyState';
import { CategoryIcon } from '@/components/CategoryIcon';
import { SearchIcon } from '@/components/icons/SearchIcon';
import { EyeIcon } from '@/components/icons/EyeIcon';
import { MessageIcon } from '@/components/icons/MessageIcon';
import { TargetIcon } from '@/components/icons/TargetIcon';
import { EmptySearchIcon } from '@/components/icons/illustrated/EmptySearchIcon';
import { Skeleton } from '@/components/Skeleton';

const RECENTLY_VIEWED_KEY = 'taskhunt:recentlyViewed';

interface RecentlyViewedEntry {
  id: string;
  title: string;
  viewedAt: number;
}

function readRecentlyViewed(): RecentlyViewedEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENTLY_VIEWED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function compatibilityColor(percent: number) {
  if (percent >= 70) return 'bg-emerald-100 text-emerald-700';
  if (percent >= 40) return 'bg-amber-100 text-amber-700';
  return 'bg-stone-100 text-stone-600';
}

export default function CategoryOrdersPage() {
  const params = useParams<{ id: string }>();
  const categoryId = params.id;

  const [me, setMe] = useState<User | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [minBudget, setMinBudget] = useState('');
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedEntry[]>([]);
  const [childFilter, setChildFilter] = useState('');

  useEffect(() => {
    api<User>('/users/me')
      .then(setMe)
      .catch(() => undefined);
    setRecentlyViewed(readRecentlyViewed());
  }, []);

  useEffect(() => {
    api<Category[]>('/categories')
      .then((categories) => {
        const flat = categories.flatMap((c) => [c, ...(c.children ?? [])]);
        setCategory(flat.find((c) => c.id === categoryId) ?? null);
      })
      .catch(() => undefined);
  }, [categoryId]);

  useEffect(() => {
    setLoading(true);
    const timeout = setTimeout(() => {
      const params = new URLSearchParams({ categoryId });
      if (search) params.set('search', search);
      if (minBudget) params.set('minBudget', minBudget);
      api<PaginatedOrders>(`/orders?${params.toString()}`)
        .then((page) => setOrders(page.items))
        .catch(() => undefined)
        .finally(() => setLoading(false));
    }, 350);
    return () => clearTimeout(timeout);
  }, [categoryId, search, minBudget]);

  const isFreelancer = me?.roles.includes('FREELANCER') ?? false;
  const recentlyViewedHere = recentlyViewed.filter((r) => orders.some((o) => o.id === r.id));
  const filteredChildren = (category?.children ?? []).filter((child) =>
    child.name.toLowerCase().includes(childFilter.trim().toLowerCase()),
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <AppHeader />

      <section className="premium-panel mb-6 rounded-[2rem] p-6">
        <div className="flex flex-wrap items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            {category && (
              <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-cream-100">
                <CategoryIcon slug={category.slug} className="h-20 w-20" />
              </span>
            )}
        <div>
              <p className="text-sm font-semibold text-brand">Категория</p>
              <h1 className="mt-1 font-serif text-3xl text-stone-900">{category?.name ?? 'Категория'}</h1>
              <p className="mt-2 text-sm text-stone-500">{orders.length} заказов в текущей выдаче</p>
          {category?.children && category.children.length > 0 && (
            <div className="mt-3 max-w-xl">
              {category.children.length > 8 && (
                <input
                  value={childFilter}
                  onChange={(e) => setChildFilter(e.target.value)}
                  placeholder={`Найти нишу среди ${category.children.length}...`}
                  className="field-surface mb-2 w-full max-w-xs px-3 py-1.5 text-xs"
                />
              )}
              <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto pr-1">
                {filteredChildren.map((child) => (
                  <Link
                    key={child.id}
                    href={`/categories/${child.id}`}
                    className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600 transition hover:bg-brand/10 hover:text-brand"
                  >
                    {child.name}
                  </Link>
                ))}
                {filteredChildren.length === 0 && <p className="text-xs text-stone-400">Ничего не найдено.</p>}
              </div>
            </div>
          )}
            </div>
          </div>
          <Link href={`/search?type=orders&q=${encodeURIComponent(category?.name ?? '')}`} className="secondary-action px-4 py-2 text-sm">
            Искать шире
          </Link>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div>
          <div className="premium-panel mb-6 flex flex-wrap items-center gap-3 rounded-3xl p-3">
            <div className="flex min-w-0 flex-1 items-center gap-2 px-2">
              <SearchIcon className="h-4 w-4 shrink-0 text-stone-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск внутри категории…"
                className="min-w-0 flex-1 py-1.5 text-sm outline-none"
              />
            </div>
            <input
              type="number"
              min="1"
              value={minBudget}
              onChange={(e) => setMinBudget(e.target.value)}
              placeholder="Бюджет от"
              className="field-surface w-32 px-3 py-1.5 text-sm"
            />
          </div>

          {loading && (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-3xl border border-stone-100 bg-white p-5 shadow-sm">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="mt-3 h-3 w-full" />
                  <Skeleton className="mt-2 h-3 w-3/4" />
                </div>
              ))}
            </div>
          )}

          {!loading && orders.length === 0 && (
            <EmptyState
              icon={<EmptySearchIcon />}
              title="Заказов не нашлось"
              description="Попробуйте другой поиск или сбросьте фильтр по бюджету."
            />
          )}

          {!loading && orders.length > 0 && (
            <div className="space-y-3">
              {orders.map((order) => (
                <article
                  key={order.id}
                  className="interactive-card min-w-0 rounded-3xl border border-stone-100 bg-white p-5 shadow-sm"
                >
                  <div className="flex min-w-0 flex-wrap items-start justify-between gap-3">
                    <Link href={`/orders/${order.id}`} className="min-w-0 max-w-full break-words text-lg font-semibold leading-snug hover:text-brand">
                      {order.title}
                    </Link>
                    <div className="min-w-0 shrink-0 text-right">
                      <p className="break-words font-semibold leading-tight">{money(order.budgetMin, order.currency)}</p>
                      {order.deadline && (
                        <p className="break-words text-xs text-stone-500">до {new Date(order.deadline).toLocaleDateString('ru-RU')}</p>
                      )}
                    </div>
                  </div>

                  <p className="mt-2 line-clamp-4 break-words text-sm leading-6 text-stone-600">{order.description}</p>

                  {order.tags && order.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {order.tags.map((tag) => (
                        <span key={tag} className="max-w-full break-words rounded-full bg-card-sand px-2 py-0.5 text-xs text-stone-700">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-stone-500">
                    <span className="flex items-center gap-1">
                      <EyeIcon className="h-4 w-4" />
                      {order.viewsCount ?? 0} просмотров
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageIcon className="h-4 w-4" />
                      {order._count?.bids ?? 0} откликов
                    </span>
                    {isFreelancer && typeof order.compatibilityPercent === 'number' && (
                      <span
                        className={`min-w-0 break-words rounded-full px-2.5 py-1 text-xs font-medium sm:ml-auto sm:flex sm:items-center sm:gap-1 ${compatibilityColor(order.compatibilityPercent)}`}
                      >
                        <TargetIcon className="h-3.5 w-3.5" />
                        {order.compatibilityPercent}% по вашим навыкам
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>

        {recentlyViewedHere.length > 0 && (
          <aside className="premium-panel h-fit rounded-3xl p-4">
            <h2 className="mb-3 text-sm font-semibold text-stone-700">Вы недавно смотрели</h2>
            <div className="space-y-2">
              {recentlyViewedHere.slice(0, 5).map((item) => (
                <Link
                  key={item.id}
                  href={`/orders/${item.id}`}
                  className="block truncate rounded-lg px-2 py-1.5 text-sm text-stone-600 transition hover:bg-stone-50 hover:text-brand"
                >
                  {item.title}
                </Link>
              ))}
            </div>
          </aside>
        )}
      </div>
    </main>
  );
}
