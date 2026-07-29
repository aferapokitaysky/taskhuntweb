'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { User } from '@/lib/types';
import { Logo } from './Logo';
import { NotificationBell } from './NotificationBell';

const NAV_LINKS = [
  { href: '/dashboard', label: 'Заказы' },
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
    <header className="mb-8 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/60 px-4 py-3">
      <Link href="/dashboard" className="shrink-0 transition-transform hover:scale-105">
        <Logo className="h-8" />
      </Link>
      <nav className="flex flex-wrap items-center gap-1 text-sm font-medium">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-full px-3 py-1.5 transition ${
              pathname === link.href ? 'bg-brand/10 text-brand' : 'text-stone-600 hover:bg-white'
            }`}
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="flex shrink-0 items-center gap-2">
        <NotificationBell />
        <Link
          href="/profile"
          className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
            pathname === '/profile' ? 'border-brand bg-brand/10 text-brand' : 'border-stone-300 text-stone-700 hover:bg-white'
          }`}
        >
          Профиль
        </Link>
      </div>
    </header>
  );
}
