'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, API_URL } from '@/lib/api';
import type { User } from '@/lib/types';
import { Logo } from './Logo';
import { NotificationBell } from './NotificationBell';
import { HeaderSearch } from './HeaderSearch';

const NAV_LINKS = [
  { href: '/dashboard', label: 'Заказы' },
  { href: '/categories', label: 'Категории' },
  { href: '/freelancers', label: 'Фрилансеры' },
  { href: '/pricing', label: 'Тарифы' },
  { href: '/referrals', label: 'Партнёрка' },
  { href: '/support', label: 'Поддержка' },
];

/** Общая шапка для всех страниц личного кабинета — лого, навигация, колокольчик, профиль. */
export function AppHeader() {
  const pathname = usePathname();
  const [me, setMe] = useState<User | null>(null);

  useEffect(() => {
    api<User>('/users/me')
      .then(setMe)
      .catch(() => undefined);
  }, []);

  const links = me?.isStaff ? [...NAV_LINKS, { href: '/admin', label: 'Admin' }] : NAV_LINKS;

  return (
    <header className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-white px-5 py-4 shadow-sm">
      <Link href="/dashboard" className="shrink-0 transition-transform hover:scale-105">
        <Logo className="h-11" />
      </Link>
      <nav className="flex flex-wrap items-center gap-1 text-sm font-medium">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-full px-3.5 py-2 transition ${
              pathname === link.href ? 'bg-brand/10 text-brand' : 'text-stone-600 hover:bg-stone-100'
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="flex shrink-0 items-center gap-2">
        <HeaderSearch />
        <NotificationBell />
        <Link
          href="/profile"
          className={`flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3.5 text-sm font-medium transition ${
            pathname === '/profile' ? 'border-brand bg-brand/10 text-brand' : 'border-stone-300 text-stone-700 hover:bg-stone-50'
          }`}
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full bg-card-sand font-serif text-xs text-stone-900">
            {me?.profile?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`${API_URL}${me.profile.avatarUrl}`} alt="" className="h-full w-full object-cover" />
            ) : (
              me?.profile?.displayName?.charAt(0).toUpperCase() ?? '?'
            )}
          </span>
          Профиль
        </Link>
      </div>
    </header>
  );
}
