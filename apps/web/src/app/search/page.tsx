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
import { SearchIcon } from '@/components/icons/SearchIcon';

interface SearchResult {
  orders: Order[];
  freelancers: FreelancerListItem[];
}

/**
 * Пока `GET /search` не подключён (или временно недоступен) — падаем
 * назад на два параллельных запроса к уже существующим эндпоинтам, не
 * блокируем страницу зависимостью от бэкенда другого раунда.
 */
async function fetchSearchResults(query: string): Promise<SearchResult> {
  try {
    return await api<SearchResult>(`/search?q=${encodeURIComponent(query)}`);
  } catch {
    const [ordersPage, freelancers] = await Promise.all([
      api<PaginatedOrders>(`/orders?search=${encodeURIComponent(query)}&limit=10`).catch(
        () => ({ items: [] }) as Pick<PaginatedOrders, 'items'>,
      ),
      api<FreelancerListItem[]>(`/freelancers?search=${encodeURIComponent(query)}`).catch(() => []),
    ]);
    return { orders: ordersPage.items.slice(0, 10), freelancers: freelancers.slice(0, 10) };
  }
}

function SearchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';

  const [query, setQuery] = useState(initialQuery);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setQuery(initialQuery);
    if (!initialQuery.trim()) {
      setResult(null);
      return;
    }
    setLoading(true);
    fetchSearchResults(initialQuery)
      .then(setResult)
      .finally(() => setLoading(false));
  }, [initialQuery]);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  const hasResults = result && (result.orders.length > 0 || result.freelancers.length > 0);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <AppHeader />

      <form onSubmit={submitSearch} className="mb-8">
        <div className="flex items-center gap-3 rounded-2xl bg-white p-2 pl-4 shadow-sm">
          <SearchIcon className="h-5 w-5 shrink-0 text-stone-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Заказы, навыки, фрилансеры…"
            className="min-w-0 flex-1 py-2 text-sm outline-none"
          />
          <button type="submit" className="shrink-0 rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark">
            Искать
          </button>
        </div>
      </form>

      {loading && <p className="text-stone-500">Ищем…</p>}

      {!loading && initialQuery && !hasResults && (
        <EmptyState icon={<EmptySearchIcon />} title={`Ничего не нашли по «${initialQuery}»`} description="Попробуйте другое слово или загляните в категории." />
      )}

      {!loading && result && hasResults && (
        <div className="grid gap-8 lg:grid-cols-2">
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
        </div>
      )}
    </main>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-5xl px-4 py-8 text-stone-500">Загружаем…</main>}>
      <SearchPageContent />
    </Suspense>
  );
}
