'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Category } from '@/lib/types';
import { AppHeader } from '@/components/AppHeader';
import { CategoryIcon } from '@/components/CategoryIcon';
import { SearchIcon } from '@/components/icons/SearchIcon';

export default function CategoriesPage() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    api<Category[]>('/categories')
      .then(setCategories)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <AppHeader />
      <h1 className="mb-2 font-serif text-3xl text-stone-900">Категории</h1>
      <p className="mb-6 text-stone-500">Выберите нишу или найдите заказ по ключевому слову.</p>

      <form onSubmit={submitSearch} className="mb-8">
        <div className="flex items-center gap-3 rounded-2xl bg-white p-2 pl-4 shadow-sm">
          <SearchIcon className="h-5 w-5 shrink-0 text-stone-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Например: лендинг на React"
            className="min-w-0 flex-1 py-2 text-sm outline-none"
          />
          <button type="submit" className="shrink-0 rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark">
            Искать
          </button>
        </div>
      </form>

      {loading ? (
        <p className="text-stone-500">Загружаем категории…</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <div
              key={category.id}
              className="rounded-3xl border border-stone-100 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
            >
              <Link href={`/dashboard?categoryId=${category.id}`} className="flex items-start gap-3">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center">
                  <CategoryIcon slug={category.slug} className="h-20 w-20" />
                </div>
                <div>
                  <p className="font-serif text-lg text-stone-900">{category.name}</p>
                  <p className="text-xs text-stone-500">{category.orderCount ?? 0} открытых заказов</p>
                </div>
              </Link>
              {category.children && category.children.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5 border-t border-stone-100 pt-4">
                  {category.children.map((child) => (
                    <Link
                      key={child.id}
                      href={`/dashboard?categoryId=${child.id}`}
                      className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600 transition hover:bg-brand/10 hover:text-brand"
                    >
                      {child.name}
                      {typeof child.orderCount === 'number' && child.orderCount > 0 && (
                        <span className="ml-1 text-stone-400">{child.orderCount}</span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
