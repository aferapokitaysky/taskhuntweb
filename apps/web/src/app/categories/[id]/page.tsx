'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Category, Order, User } from '@/lib/types';
import { money } from '@/lib/types';
import { AppHeader } from '@/components/AppHeader';
import { EmptyState } from '@/components/EmptyState';
import { CategoryIcon } from '@/components/CategoryIcon';
import { SearchIcon } from '@/components/icons/SearchIcon';
import { EyeIcon } from '@/components/icons/EyeIcon';
import { MessageIcon } from '@/components/icons/MessageIcon';
import { TargetIcon } from '@/components/icons/TargetIcon';
import { EmptySearchIcon } from '@/components/icons/illustrated/EmptySearchIcon';

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
      api<Order[]>(`/orders?${params.toString()}`)
        .then(setOrders)
        .catch(() => undefined)
        .finally(() => setLoading(false));
    }, 350);
    return () => clearTimeout(timeout);
  }, [categoryId, search, minBudget]);

  const isFreelancer = me?.roles.includes('FREELANCER') ?? false;
  const recentlyViewedHere = recentlyViewed.filter((r) => orders.some((o) => o.id === r.id));

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <AppHeader />

      <div className="mb-6 flex items-center gap-4">
        {category && <CategoryIcon slug={category.slug} className="h-16 w-16 shrink-0" />}
        <div>
          <h1 className="font-serif text-3xl text-stone-900">{category?.name ?? 'Категория'}</h1>
          {category?.children && category.children.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {category.children.map((child) => (
                <Link
                  key={child.id}
                  href={`/categories/${child.id}`}
                  className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600 transition hover:bg-brand/10 hover:text-brand"
                >
                  {child.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div>
          <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl bg-white p-3 shadow-sm">
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
              className="w-32 rounded-lg border border-stone-200 px-3 py-1.5 text-sm"
            />
          </div>

          {loading && <p className="text-stone-500">Загружаем заказы…</p>}

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
                  className="rounded-2xl border border-stone-100 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <Link href={`/orders/${order.id}`} className="text-lg font-semibold hover:text-brand">
                      {order.title}
                    </Link>
                    <div className="text-right">
                      <p className="font-semibold">{money(order.budgetMin, order.currency)}</p>
                      {order.deadline && (
                        <p className="text-xs text-stone-500">до {new Date(order.deadline).toLocaleDateString('ru-RU')}</p>
                      )}
                    </div>
                  </div>

                  <p className="mt-2 line-clamp-4 text-sm text-stone-600">{order.description}</p>

                  {order.tags && order.tags.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {order.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-card-sand px-2 py-0.5 text-xs text-stone-700">
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
                        className={`ml-auto flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${compatibilityColor(order.compatibilityPercent)}`}
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
          <aside className="h-fit rounded-2xl bg-white p-4 shadow-sm">
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
