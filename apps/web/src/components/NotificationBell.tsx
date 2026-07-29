'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { BellIcon } from './icons/BellIcon';

interface Notification {
  id: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

const POLL_INTERVAL_MS = 30000;

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  function load() {
    api<{ notifications: Notification[]; unreadCount: number }>('/notifications/me')
      .then((data) => {
        setNotifications(data.notifications);
        setUnreadCount(data.unreadCount);
      })
      .catch(() => undefined); // не логинен/эндпоинт недоступен — молча не показываем
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
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

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative p-1.5 text-stone-700 transition-transform hover:scale-110 hover:text-brand"
        aria-label="Уведомления"
      >
        <BellIcon className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
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
            {notifications.length === 0 && <p className="px-4 py-6 text-center text-sm text-stone-400">Пока пусто</p>}
          </div>
        </div>
      )}
    </div>
  );
}
