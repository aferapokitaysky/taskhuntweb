'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { User } from '@/lib/types';
import { BellIcon } from './icons/BellIcon';

interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

interface RecommendedOrder {
  id: string;
  title: string;
  compatibilityPercent: number | null;
}

const POLL_INTERVAL_MS = 30000;
const MATCH_THRESHOLD = 50;
const SEEN_MATCHES_KEY = 'th_seen_reco_orders';

function loadSeenIds(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SEEN_MATCHES_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [matches, setMatches] = useState<RecommendedOrder[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  function load() {
    api<{ notifications: Notification[]; unreadCount: number }>('/notifications/me')
      .then((data) => {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      })
      .catch(() => undefined); // не логинен/эндпоинт недоступен — молча не показываем
  }

  function loadMatches() {
    api<User>('/users/me')
      .then((me) => {
        if (!me.roles.includes('FREELANCER')) return;
        return api<RecommendedOrder[]>('/freelancers/me/recommended-orders?limit=50').then((orders) => {
          const seen = loadSeenIds();
          const fresh = orders.filter(
            (o) => o.compatibilityPercent !== null && o.compatibilityPercent >= MATCH_THRESHOLD && !seen.has(o.id),
          );
          setMatches(fresh);
        });
      })
      .catch(() => undefined);
  }

  function dismissMatches() {
    const seen = loadSeenIds();
    matches.forEach((m) => seen.add(m.id));
    localStorage.setItem(SEEN_MATCHES_KEY, JSON.stringify([...seen]));
    setMatches([]);
  }

  function goToMatches() {
    dismissMatches();
    setOpen(false);
    router.push('/dashboard');
  }

  useEffect(() => {
    load();
    loadMatches();
    const interval = setInterval(() => {
      load();
      loadMatches();
    }, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function markRead(id: string) {
    setNotifications((current) => current.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((count) => Math.max(0, count - 1));
    await api(`/notifications/${id}/read`, { method: 'PATCH' }).catch(() => undefined);
  }

  async function markAllRead() {
    setNotifications((current) => current.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    await api('/notifications/read-all', { method: 'PATCH' }).catch(() => undefined);
  }

  const badgeCount = unreadCount + (matches.length > 0 ? 1 : 0);
  const avgCompat =
    matches.length > 0
      ? Math.round(matches.reduce((sum, m) => sum + (m.compatibilityPercent ?? 0), 0) / matches.length)
      : 0;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-1.5 text-stone-700 transition-transform hover:scale-110 hover:text-brand"
        aria-label="Уведомления"
      >
        <BellIcon className="h-6 w-6" />
        {badgeCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white">
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-10 mt-2 w-80 rounded-lg border border-stone-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
            <p className="font-semibold">Уведомления</p>
            {unreadCount > 0 && (
              <button type="button" onClick={markAllRead} className="text-xs font-medium text-brand hover:underline">
                Прочитать всё
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {matches.length > 0 && (
              <button
                type="button"
                onClick={goToMatches}
                className="block w-full border-b border-stone-100 bg-gradient-to-r from-brand/15 to-card-sand/40 px-4 py-3 text-left transition hover:from-brand/25"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-sm">✨</span>
                  <div>
                    <p className="text-sm font-semibold text-stone-900">
                      Вам подошло {matches.length} {pluralOrders(matches.length)}
                    </p>
                    <p className="mt-0.5 text-xs text-stone-600">Среднее совпадение {avgCompat}% — нажмите, чтобы откликнуться</p>
                  </div>
                </div>
              </button>
            )}
            {notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => !n.read && markRead(n.id)}
                className={`block w-full border-b border-stone-50 px-4 py-3 text-left text-sm hover:bg-stone-50 ${
                  n.read ? 'opacity-60' : 'bg-brand/10'
                }`}
              >
                <p className="font-medium">{n.title}</p>
                <p className="mt-0.5 text-xs text-stone-500">{n.message}</p>
              </button>
            ))}
            {notifications.length === 0 && matches.length === 0 && (
              <p className="px-4 py-6 text-center text-sm text-stone-400">Пока пусто</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function pluralOrders(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'заказ';
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return 'заказа';
  return 'заказов';
}
