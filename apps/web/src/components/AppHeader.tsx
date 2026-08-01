'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentType } from 'react';
import { useEffect, useState } from 'react';
import { api, API_URL } from '@/lib/api';
import type { ChatInboxThread, User } from '@/lib/types';
import { Logo } from './Logo';
import { NotificationBell } from './NotificationBell';
import { HeaderSearch } from './HeaderSearch';
import { ThemeToggle } from './ThemeToggle';
import { AdminNavIcon } from './icons/illustrated/AdminNavIcon';
import { CategoriesNavIcon } from './icons/illustrated/CategoriesNavIcon';
import { ChatIcon } from './icons/illustrated/ChatIcon';
import { OrdersNavIcon } from './icons/illustrated/OrdersNavIcon';
import { PricingNavIcon } from './icons/illustrated/PricingNavIcon';
import { ProfileNavIcon } from './icons/illustrated/ProfileNavIcon';
import { ReferralNavIcon } from './icons/illustrated/ReferralNavIcon';
import { SupportNavIcon } from './icons/illustrated/SupportNavIcon';
import { TalentNavIcon } from './icons/illustrated/TalentNavIcon';

type NavIcon = ComponentType<{ className?: string }>;

type NavLink = {
  href: string;
  label: string;
  Icon: NavIcon;
  staffOnly?: boolean;
};

const NAV_LINKS: NavLink[] = [
  { href: '/dashboard', label: 'Заказы', Icon: OrdersNavIcon },
  { href: '/chats', label: 'Чаты', Icon: ChatIcon },
  { href: '/categories', label: 'Категории', Icon: CategoriesNavIcon },
  { href: '/freelancers', label: 'Фрилансеры', Icon: TalentNavIcon },
  { href: '/pricing', label: 'Тарифы', Icon: PricingNavIcon },
  { href: '/referrals', label: 'Партнёрка', Icon: ReferralNavIcon },
  { href: '/support', label: 'Поддержка', Icon: SupportNavIcon },
];

/** Общая шапка для всех страниц личного кабинета — лого, навигация, колокольчик, профиль. */
export function AppHeader() {
  const pathname = usePathname();
  const [me, setMe] = useState<User | null>(null);
  const [chatUnreadCount, setChatUnreadCount] = useState(0);

  useEffect(() => {
    api<User>('/users/me')
      .then(setMe)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    function loadChatUnread() {
      api<ChatInboxThread[]>('/chat/threads')
        .then((threads) => setChatUnreadCount(threads.reduce((sum, thread) => sum + (thread.unreadCount ?? 0), 0)))
        .catch(() => undefined);
    }
    loadChatUnread();
    const interval = setInterval(loadChatUnread, 30000);
    return () => clearInterval(interval);
  }, []);

  const links: NavLink[] = [...NAV_LINKS, { href: '/admin', label: 'Admin', Icon: AdminNavIcon, staffOnly: true }].filter(
    (link) => !link.staffOnly || me?.isStaff,
  );
  return (
    <div className="relative left-1/2 right-1/2 z-30 mb-8 flex w-screen -translate-x-1/2 justify-center px-4">
      <header className="app-shell-header premium-panel relative flex w-full max-w-[1500px] items-center gap-2 rounded-[1.75rem] px-2 py-2 dark:bg-stone-900 md:gap-3 md:px-3">
        <Link href="/dashboard" className="app-logo-link shrink-0 rounded-[1.25rem] px-1.5 py-1 transition-transform hover:scale-105 md:px-2">
          <span className="hidden min-[861px]:block">
            <Logo className="h-11" />
          </span>
          <span className="block min-[861px]:hidden">
            <Logo withWordmark={false} className="h-10 w-10" />
          </span>
        </Link>

        <div className="min-w-0 flex-1">
          <nav className="app-nav grid min-w-0 grid-flow-col auto-cols-fr items-center gap-1 rounded-[1.35rem] bg-stone-50/80 p-1 text-[11px] font-semibold dark:bg-stone-950/40 lg:text-xs">
            {links.map((link) => {
              const active = pathname === link.href;
              const Icon = link.Icon;
              const isChats = link.href === '/chats';
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  title={link.label}
                  className={`group flex h-10 min-w-0 items-center justify-center gap-1 overflow-hidden rounded-[1.05rem] px-1.5 py-2 transition md:gap-1.5 lg:px-2 ${
                    active
                      ? 'bg-white text-brand shadow-sm ring-1 ring-brand/15 dark:bg-stone-800'
                      : 'text-stone-600 hover:bg-white hover:text-stone-950 dark:text-stone-300 dark:hover:bg-stone-800'
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0 transition group-hover:scale-105" />
                  <span className="app-nav-label whitespace-nowrap">{link.label}</span>
                  {isChats && chatUnreadCount > 0 && (
                    <span className="ml-0.5 flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-brand px-1.5 text-[10px] font-bold leading-none text-white shadow-sm">
                      {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-1.5 md:gap-2">
          <HeaderSearch />
          <ThemeToggle />
          <NotificationBell />
          <Link
            href="/profile"
            className={`flex items-center gap-2 whitespace-nowrap rounded-full border py-1.5 pl-1.5 pr-2 text-sm font-medium transition sm:pr-3.5 ${
              pathname === '/profile'
                ? 'border-brand bg-brand/10 text-brand'
                : 'border-stone-200 bg-white/70 text-stone-700 hover:border-brand/30 hover:bg-card-sand/50 dark:border-stone-700 dark:text-stone-200 dark:hover:bg-stone-800'
            }`}
          >
            <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-stone-200 bg-card-sand text-stone-950 shadow-sm dark:border-stone-700 dark:bg-stone-800 dark:text-stone-100">
              {me?.profile?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={`${API_URL}${me.profile.avatarUrl}`} alt="" className="h-full w-full object-cover" />
              ) : (
                <ProfileNavIcon className="h-7 w-7" />
              )}
            </span>
            <span className="hidden sm:inline">Профиль</span>
          </Link>
        </div>
      </header>
    </div>
  );
}
