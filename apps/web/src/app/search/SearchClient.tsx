'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import type { Order, PaginatedOrders } from '@/lib/types';
import { AppHeader } from '@/components/AppHeader';
import { OrderCard } from '@/components/OrderCard';
import { FreelancerCard, type FreelancerListItem } from '@/components/FreelancerCard';
import { EmptyState } from '@/components/EmptyState';
import { EmptySearchIcon } from '@/components/icons/illustrated/EmptySearchIcon';
import { MatchReasonIcon } from '@/components/icons/illustrated/MatchReasonIcon';
import { SavedSearchIcon } from '@/components/icons/illustrated/SavedSearchIcon';
import { ClientIcon } from '@/components/icons/illustrated/ClientIcon';
import { SearchIcon } from '@/components/icons/SearchIcon';
import { Mascot } from '@/components/Mascot';

interface SearchResult {
  orders: Order[];
  freelancers: FreelancerListItem[];
}

interface TrendingSearch {
  query: string;
  count: number;
}

type SearchMode = 'all' | 'orders' | 'freelancers';

const POPULAR_QUERIES = ['React', 'лендинг', 'дизайн', 'бот', 'маркетинг', 'копирайтинг', 'перевод', 'ремонт'];

const STARTER_CARDS = [
  {
    title: 'Найти заказ',
    description: 'Покажем открытые задачи по навыкам, бюджету и свежести публикации.',
    icon: <SavedSearchIcon />,
    action: 'Искать заказы',
    type: 'orders' as SearchMode,
    query: 'React',
  },
  {
    title: 'Найти исполнителя',
    description: 'Сравните профили, навыки и историю сделок перед приглашением.',
    icon: <ClientIcon />,
    action: 'Искать фрилансеров',
    type: 'freelancers' as SearchMode,
    query: 'дизайн',
  },
  {
    title: 'Понять совпадение',
    description: 'Готовим explainable matching: почему заказ или профиль подходит именно вам.',
    icon: <MatchReasonIcon />,
    action: 'Посмотреть примеры',
    type: 'all' as SearchMode,
    query: 'лендинг',
  },
];

function SearchResultsSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="rounded-3xl border border-stone-100 bg-white p-5 shadow-sm">
          <div className="h-3 w-24 animate-pulse rounded-full bg-stone-100" />
          <div className="mt-4 h-5 w-3/4 animate-pulse rounded-full bg-stone-100" />
          <div className="mt-3 h-3 w-full animate-pulse rounded-full bg-stone-100" />
          <div className="mt-2 h-3 w-2/3 animate-pulse rounded-full bg-stone-100" />
          <div className="mt-5 flex gap-2">
            <div className="h-7 w-20 animate-pulse rounded-full bg-stone-100" />
            <div className="h-7 w-24 animate-pulse rounded-full bg-stone-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Пока `GET /search` не подключён (или временно недоступен) — падаем
 * назад на два параллельных запроса к уже существующим эндпоинтам, не
 * блокируем страницу зависимостью от бэкенда другого раунда.
 */
async function fetchSearchResults(query: string, mode: SearchMode): Promise<SearchResult> {
  try {
    const data = await api<SearchResult>(`/search?q=${encodeURIComponent(query)}`);
    return {
      orders: mode === 'freelancers' ? [] : data.orders,
      freelancers: mode === 'orders' ? [] : data.freelancers,
    };
  } catch {
    const [ordersPage, freelancers] = await Promise.all([
      mode === 'freelancers'
        ? Promise.resolve(({ items: [] }) as Pick<PaginatedOrders, 'items'>)
        : api<PaginatedOrders>(`/orders?search=${encodeURIComponent(query)}&limit=10`).catch(
            () => ({ items: [] }) as Pick<PaginatedOrders, 'items'>,
          ),
      mode === 'orders'
        ? Promise.resolve([])
        : api<FreelancerListItem[]>(`/freelancers?search=${encodeURIComponent(query)}`).catch(() => []),
    ]);
    return { orders: ordersPage.items.slice(0, 10), freelancers: freelancers.slice(0, 10) };
  }
}

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';
  const initialMode = (searchParams.get('type') as SearchMode | null) ?? 'all';

  const [query, setQuery] = useState(initialQuery);
  const [mode, setMode] = useState<SearchMode>(['all', 'orders', 'freelancers'].includes(initialMode) ? initialMode : 'all');
  const [result, setResult] = useState<SearchResult | null>(null);
  const [trending, setTrending] = useState<TrendingSearch[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingSearch, setSavingSearch] = useState(false);
  const [savedSearchMessage, setSavedSearchMessage] = useState<string | null>(null);

  useEffect(() => {
    setQuery(initialQuery);
    setMode(['all', 'orders', 'freelancers'].includes(initialMode) ? initialMode : 'all');
    if (!initialQuery.trim()) {
      setResult(null);
      return;
    }
    setLoading(true);
    fetchSearchResults(initialQuery, ['all', 'orders', 'freelancers'].includes(initialMode) ? initialMode : 'all')
      .then(setResult)
      .finally(() => setLoading(false));
  }, [initialQuery, initialMode]);

  useEffect(() => {
    if (initialQuery.trim()) return;
    api<TrendingSearch[]>('/search/trending')
      .then(setTrending)
      .catch(() => setTrending([]));
  }, [initialQuery]);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    router.push(`/search?q=${encodeURIComponent(query.trim())}&type=${mode}`);
  }

  async function saveCurrentSearch() {
    if (!initialQuery.trim() || initialQuery.trim().length < 2) return;
    setSavingSearch(true);
    setSavedSearchMessage(null);
    try {
      await api('/saved-searches', {
        method: 'POST',
        body: JSON.stringify({ label: initialQuery.trim(), tags: [initialQuery.trim()] }),
      });
      setSavedSearchMessage('Поиск сохранён. Новые совпадения появятся в уведомлениях.');
    } catch (err) {
      setSavedSearchMessage(err instanceof Error ? err.message : 'Не удалось сохранить поиск');
    } finally {
      setSavingSearch(false);
    }
  }

  const hasResults = result && (result.orders.length > 0 || result.freelancers.length > 0);
  const quickQueries = trending.length > 0 ? trending.map((item) => item.query) : POPULAR_QUERIES;

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <AppHeader />

      <form onSubmit={submitSearch} className="mb-8">
        <div className="premium-panel rounded-3xl p-3">
          <div className="mb-2 flex items-center justify-between gap-3 px-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-400">Умный поиск</p>
            <Mascot name="magnifierPro" size="h-8 w-8" />
          </div>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_170px_auto]">
            <label className="flex min-w-0 items-center gap-3 rounded-2xl border border-stone-200 px-4 py-3">
              <SearchIcon className="h-5 w-5 shrink-0 text-stone-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Заказы, навыки, фрилансеры…"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
              />
            </label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as SearchMode)}
              className="field-surface px-4 py-3 text-sm text-stone-700"
            >
              <option value="all">Везде</option>
              <option value="orders">Заказы</option>
              <option value="freelancers">Фрилансеры</option>
            </select>
            <button type="submit" className="primary-action shrink-0 px-6 py-3 text-sm">
              Искать
            </button>
          </div>
        </div>
      </form>

      {initialQuery && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-stone-100 bg-white px-4 py-3 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-stone-900">Поиск: «{initialQuery}»</p>
            <p className="text-xs text-stone-500">Сохраните запрос, чтобы не проверять рынок вручную.</p>
          </div>
          <button type="button" onClick={saveCurrentSearch} disabled={savingSearch} className="secondary-action px-4 py-2 text-sm">
            {savingSearch ? 'Сохраняем...' : 'Сохранить поиск'}
          </button>
          {savedSearchMessage && <p className="w-full text-xs text-stone-500">{savedSearchMessage}</p>}
        </div>
      )}

      {loading && <SearchResultsSkeleton />}

      {!loading && !initialQuery && (
        <section className="space-y-5">
          <div className="premium-panel rounded-3xl p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-brand">Поиск по рынку</p>
                <h1 className="mt-1 font-serif text-3xl text-stone-900">Что ищем сегодня?</h1>
                <p className="mt-2 max-w-2xl text-stone-600">
                  Начните с навыка, ниши или типа задачи. Результаты разделятся на заказы и специалистов, чтобы не
                  смешивать разные намерения в одну ленту.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Mascot name="guideQuestion" size="h-14 w-14" />
                <button type="button" onClick={() => router.push('/register?role=CLIENT')} className="secondary-action px-4 py-2 text-sm">
                  Разместить заказ
                </button>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              {quickQueries.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => router.push(`/search?q=${encodeURIComponent(item)}&type=${mode}`)}
                  className="rounded-full bg-stone-100 px-4 py-2 text-sm font-medium text-stone-700 transition hover:-translate-y-0.5 hover:bg-card-sand"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {STARTER_CARDS.map((card) => (
              <button
                key={card.title}
                type="button"
                onClick={() => router.push(`/search?q=${encodeURIComponent(card.query)}&type=${card.type}`)}
                className="interactive-card rounded-3xl border border-stone-100 bg-white p-5 text-left shadow-sm"
              >
                <div className="flex h-16 w-16 items-center justify-center">{card.icon}</div>
                <h2 className="mt-4 text-lg font-semibold text-stone-900">{card.title}</h2>
                <p className="mt-2 text-sm leading-6 text-stone-600">{card.description}</p>
                <span className="mt-4 inline-flex text-sm font-semibold text-brand">{card.action}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {!loading && initialQuery && !hasResults && (
        <EmptyState icon={<EmptySearchIcon />} title={`Ничего не нашли по «${initialQuery}»`} description="Попробуйте другое слово или загляните в категории." />
      )}

      {!loading && result && hasResults && (
        <div className="grid gap-8 lg:grid-cols-2">
          {mode !== 'freelancers' && (
          <section>
            <h2 className="mb-3 font-serif text-xl text-stone-900">
              Заказы {result.orders.length > 0 && <span className="text-sm font-sans text-stone-400">({result.orders.length})</span>}
            </h2>
            <div className="space-y-3">
              {result.orders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
              {result.orders.length === 0 && <p className="text-sm text-stone-400">Заказов не найдено.</p>}
            </div>
          </section>
          )}
          {mode !== 'orders' && (
          <section>
            <h2 className="mb-3 font-serif text-xl text-stone-900">
              Фрилансеры {result.freelancers.length > 0 && <span className="text-sm font-sans text-stone-400">({result.freelancers.length})</span>}
            </h2>
            <div className="space-y-3">
              {result.freelancers.map((freelancer) => (
                <FreelancerCard key={freelancer.id} freelancer={freelancer} />
              ))}
              {result.freelancers.length === 0 && <p className="text-sm text-stone-400">Фрилансеров не найдено.</p>}
            </div>
          </section>
          )}
        </div>
      )}
    </main>
  );
}

export default function SearchClient() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-5xl px-4 py-8 text-stone-500">Загружаем…</main>}>
      <SearchPageContent />
    </Suspense>
  );
}
