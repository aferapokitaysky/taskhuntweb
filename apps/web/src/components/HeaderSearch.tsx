'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { SearchIcon } from './icons/SearchIcon';

/** Компактный вход в общий поиск в шапке — иконка разворачивает инпут,
 * не занимает место в и так плотной шапке по умолчанию. */
export function HeaderSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
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
    if (open) inputRef.current?.focus();
  }, [open]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    setOpen(false);
    setQuery('');
  }

  return (
    <div ref={containerRef} className="relative flex items-center">
      {open ? (
        <form onSubmit={submit} className="flex items-center overflow-hidden rounded-full border border-stone-300 bg-white pl-3">
          <SearchIcon className="h-4 w-4 shrink-0 text-stone-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
            placeholder="Поиск по TaskHunt"
            className="w-40 px-2 py-1.5 text-sm outline-none sm:w-56"
          />
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="p-1.5 text-stone-700 transition-transform hover:scale-110 hover:text-brand"
          aria-label="Поиск"
        >
          <SearchIcon className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
