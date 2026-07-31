'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { SearchIcon } from './icons/SearchIcon';

const QUICK_SUGGESTIONS = ['React', 'дизайн', 'лендинг', 'SMM'];

interface SearchSuggestResponse {
  orders: { id: string; title: string }[];
  skills: { id: string; name: string; slug: string }[];
  categories: { id: string; name: string; slug: string }[];
  freelancers: { id: string; displayName: string; avatarUrl?: string | null }[];
}

/** Компактный вход в общий поиск в шапке — иконка разворачивает инпут,
 * не занимает место в и так плотной шапке по умолчанию. */
export function HeaderSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [renderPanel, setRenderPanel] = useState(false);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SearchSuggestResponse | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (open) {
      setRenderPanel(true);
      window.setTimeout(() => inputRef.current?.focus(), 80);
      return;
    }
    const timeout = window.setTimeout(() => setRenderPanel(false), 220);
    return () => window.clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!open || trimmed.length < 1) {
      setSuggestions(null);
      setSuggesting(false);
      return;
    }

    let cancelled = false;
    setSuggesting(true);
    const timeout = window.setTimeout(() => {
      api<SearchSuggestResponse>(`/search/suggest?q=${encodeURIComponent(trimmed)}`)
        .then((data) => {
          if (!cancelled) setSuggestions(data);
        })
        .catch(() => {
          if (!cancelled) setSuggestions(null);
        })
        .finally(() => {
          if (!cancelled) setSuggesting(false);
        });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [open, query]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    setOpen(false);
    setQuery('');
  }

  function goToSearch(nextQuery: string, type: 'all' | 'orders' | 'freelancers' = 'all') {
    router.push(`/search?q=${encodeURIComponent(nextQuery)}&type=${type}`);
    setOpen(false);
    setQuery('');
  }

  const hasSuggestions =
    suggestions &&
    (suggestions.orders.length > 0 ||
      suggestions.skills.length > 0 ||
      suggestions.categories.length > 0 ||
      suggestions.freelancers.length > 0);

  return (
    <div ref={containerRef} className="flex h-10 w-10 shrink-0 items-center justify-center">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`rounded-full p-2 text-stone-700 transition-all hover:scale-110 hover:bg-brand/10 hover:text-brand dark:text-stone-200 dark:hover:bg-stone-800 ${
          open ? 'bg-brand/10 text-brand' : ''
        }`}
        aria-label="Поиск"
      >
        <SearchIcon className="h-5 w-5" />
      </button>

      {renderPanel && (
        <div className={`header-search-overlay ${open ? 'header-search-overlay-open' : 'header-search-overlay-closed'}`}>
          <form onSubmit={submit} className="header-search-surface flex h-full items-center overflow-hidden rounded-[1.35rem] px-3">
            <SearchIcon className="h-4 w-4 shrink-0 text-stone-400" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
              placeholder="Поиск по TaskHunt"
              className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm outline-none dark:text-stone-100 dark:placeholder:text-stone-500"
            />
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setQuery('');
              }}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-2xl leading-none text-stone-500 transition hover:bg-stone-100 hover:text-stone-900 dark:text-stone-300 dark:hover:bg-stone-800 dark:hover:text-stone-100"
              aria-label="Закрыть поиск"
            >
              ×
            </button>
          </form>
          <div className="header-search-dropdown mt-2 max-h-[min(62vh,28rem)] overflow-y-auto rounded-3xl p-3">
            {query.trim() ? (
              <div className="grid gap-3">
                <div className="grid gap-2">
                  <button
                    type="button"
                    onClick={() => goToSearch(query.trim(), 'orders')}
                    className="rounded-2xl px-3 py-2 text-left text-sm font-medium text-stone-700 transition hover:bg-card-sand/60 dark:text-stone-200 dark:hover:bg-stone-800"
                  >
                    Искать заказы по «{query.trim()}»
                  </button>
                  <button
                    type="button"
                    onClick={() => goToSearch(query.trim(), 'freelancers')}
                    className="rounded-2xl px-3 py-2 text-left text-sm font-medium text-stone-700 transition hover:bg-card-sage/60 dark:text-stone-200 dark:hover:bg-stone-800"
                  >
                    Искать фрилансеров по «{query.trim()}»
                  </button>
                </div>

                {suggesting && (
                  <div className="space-y-2 px-2">
                    <div className="h-2 w-24 animate-pulse rounded-full bg-stone-100" />
                    <div className="h-2 w-40 animate-pulse rounded-full bg-stone-100" />
                  </div>
                )}

                {!suggesting && hasSuggestions && (
                  <div className="border-t border-stone-100 pt-3 dark:border-stone-700">
                    {suggestions.orders.slice(0, 3).map((order) => (
                      <button
                        key={order.id}
                        type="button"
                        onClick={() => goToSearch(order.title, 'orders')}
                        className="block w-full rounded-2xl px-3 py-2 text-left text-xs text-stone-600 transition hover:bg-stone-50 dark:text-stone-300 dark:hover:bg-stone-800"
                      >
                        <span className="font-semibold text-stone-900 dark:text-stone-100">Заказ</span> · {order.title}
                      </button>
                    ))}
                    {suggestions.skills.slice(0, 2).map((item) => (
                      <button
                        key={`skill-${item.id}`}
                        type="button"
                        onClick={() => goToSearch(item.name)}
                        className="block w-full rounded-2xl px-3 py-2 text-left text-xs text-stone-600 transition hover:bg-stone-50 dark:text-stone-300 dark:hover:bg-stone-800"
                      >
                        <span className="font-semibold text-stone-900 dark:text-stone-100">Навык</span> · {item.name}
                      </button>
                    ))}
                    {suggestions.categories.slice(0, 2).map((item) => (
                      <button
                        key={`category-${item.id}`}
                        type="button"
                        onClick={() => goToSearch(item.name)}
                        className="block w-full rounded-2xl px-3 py-2 text-left text-xs text-stone-600 transition hover:bg-stone-50 dark:text-stone-300 dark:hover:bg-stone-800"
                      >
                        <span className="font-semibold text-stone-900 dark:text-stone-100">Категория</span> · {item.name}
                      </button>
                    ))}
                    {suggestions.freelancers.slice(0, 2).map((freelancer) => (
                      <button
                        key={freelancer.id}
                        type="button"
                        onClick={() => goToSearch(freelancer.displayName, 'freelancers')}
                        className="block w-full rounded-2xl px-3 py-2 text-left text-xs text-stone-600 transition hover:bg-stone-50 dark:text-stone-300 dark:hover:bg-stone-800"
                      >
                        <span className="font-semibold text-stone-900 dark:text-stone-100">Фрилансер</span> · {freelancer.displayName}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                <p className="px-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Быстрый поиск</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {QUICK_SUGGESTIONS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => goToSearch(item)}
                      className="rounded-full bg-stone-100 px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-card-sand dark:bg-stone-800 dark:text-stone-200 dark:hover:bg-stone-700"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
