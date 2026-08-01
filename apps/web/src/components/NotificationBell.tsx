'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { User } from '@/lib/types';
import { pluralize } from '@/lib/pluralize';
import { BellIcon } from './icons/BellIcon';
import { AlertIcon } from './icons/illustrated/AlertIcon';
import { BalanceEscrowIcon } from './icons/illustrated/BalanceEscrowIcon';
import { BalanceMainIcon } from './icons/illustrated/BalanceMainIcon';
import { ChatIcon } from './icons/illustrated/ChatIcon';
import { MailCheckIcon } from './icons/illustrated/MailCheckIcon';
import { MatchIcon } from './icons/illustrated/MatchIcon';
import { OrdersNavIcon } from './icons/illustrated/OrdersNavIcon';
import { RocketIcon } from './icons/illustrated/RocketIcon';
import { Mascot } from './Mascot';

interface Notification {
  id: string;
  title: string;
  message: string;
  eventName: string;
  metadata?: {
    href?: string;
    orderId?: string;
    freelancerId?: string;
    threadId?: string;
    invoiceId?: string;
    bidId?: string;
    disputeId?: string;
  } | null;
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

function formatNotificationTime(createdAt: string) {
  const diffMs = Date.now() - new Date(createdAt).getTime();
  const minutes = Math.max(0, Math.floor(diffMs / 60000));
  if (minutes < 1) return 'только что';
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} дн. назад`;
  return new Date(createdAt).toLocaleDateString('ru-RU');
}

function notificationMeta(eventName: string) {
  if (eventName.includes('InvoiceIssued')) {
    return { href: '/chats', label: 'Счёт', tone: 'bg-card-sand text-stone-800', Icon: BalanceMainIcon };
  }
  if (eventName.includes('ChatMessageCreated')) {
    return { href: '/chats', label: 'Чат', tone: 'bg-card-lavender text-stone-800', Icon: ChatIcon };
  }
  if (eventName.includes('InvoicePaid') || eventName.includes('EscrowLocked') || eventName.includes('EscrowReleased')) {
    return { href: '/dashboard', label: 'Финансы', tone: 'bg-card-sage text-stone-800', Icon: BalanceEscrowIcon };
  }
  if (eventName.includes('BidSubmitted') || eventName.includes('BidAccepted') || eventName.includes('BidRejected')) {
    return { href: '/dashboard', label: 'Отклик', tone: 'bg-card-lavender text-stone-800', Icon: OrdersNavIcon };
  }
  if (eventName.includes('WorkSubmitted')) {
    return { href: '/dashboard', label: 'Проверка', tone: 'bg-card-sage text-stone-800', Icon: MailCheckIcon };
  }
  if (eventName.includes('DisputeOpened')) {
    return { href: '/support', label: 'Спор', tone: 'bg-card-rose text-stone-800', Icon: AlertIcon };
  }
  if (eventName.includes('Support')) {
    return { href: '/support', label: 'Поддержка', tone: 'bg-card-sage text-stone-800', Icon: MailCheckIcon };
  }
  if (eventName.includes('DeadlineExtension') || eventName.includes('DeadlineApproaching')) {
    return { href: '/dashboard', label: 'Сроки', tone: 'bg-card-sand text-stone-800', Icon: RocketIcon };
  }
  if (eventName.includes('OrderInvite')) {
    return { href: '/dashboard', label: 'Инвайт', tone: 'bg-card-sand text-stone-800', Icon: RocketIcon };
  }
  if (eventName.includes('SavedSearchMatch')) {
    return { href: '/dashboard', label: 'Подбор', tone: 'bg-card-sage text-stone-800', Icon: MatchIcon };
  }
  if (eventName.includes('OrderExpired')) {
    return { href: '/dashboard', label: 'Архив', tone: 'bg-card-rose text-stone-800', Icon: AlertIcon };
  }
  if (eventName.includes('FraudFlagCreated')) {
    return { href: '/admin', label: 'Риск', tone: 'bg-card-rose text-stone-800', Icon: AlertIcon };
  }
  return { href: '/dashboard', label: 'Событие', tone: 'bg-stone-100 text-stone-700', Icon: ChatIcon };
}

function notificationHref(notification: Notification) {
  if (notification.metadata?.href) return notification.metadata.href;
  if (notification.metadata?.invoiceId && notification.metadata.orderId) {
    const params = new URLSearchParams({ orderId: notification.metadata.orderId });
    if (notification.metadata.freelancerId) params.set('freelancerId', notification.metadata.freelancerId);
    return `/chats?${params.toString()}`;
  }
  if (notification.metadata?.orderId) return `/orders/${notification.metadata.orderId}`;
  return notificationMeta(notification.eventName).href;
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [matches, setMatches] = useState<RecommendedOrder[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; right: number } | null>(null);

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

  function openNotification(notification: Notification) {
    if (!notification.read) void markRead(notification.id);
    setOpen(false);
    router.push(notificationHref(notification));
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
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Дропдаун — портал в body (см. toggleOpen), поэтому позицию под кнопкой
  // нужно пересчитывать при скролле/ресайзе, пока он открыт, иначе съедет.
  // Начальную позицию считаем синхронно в toggleOpen (не в этом эффекте) —
  // эффект с зависимостью [open] отрабатывает на кадр позже, и первый рендер
  // после открытия успевал уйти с position === null, из-за чего дропдаун
  // ни разу не попадал в DOM (баг «уведомления не открываются»).
  useEffect(() => {
    if (!open) return;
    function reposition() {
      if (!buttonRef.current) return;
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
    }
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open]);

  function toggleOpen() {
    setOpen((v) => {
      const next = !v;
      if (next) {
        if (buttonRef.current) {
          const rect = buttonRef.current.getBoundingClientRect();
          setPosition({ top: rect.bottom + 8, right: window.innerWidth - rect.right });
        }
        // Открытие колокольчика = "увидел" — иначе бейдж с числом непрочитанных
        // висел до тех пор, пока не кликнуть по каждому уведомлению отдельно
        // или по "Прочитать всё", хотя пользователь их уже увидел в списке.
        markAllRead();
      }
      return next;
    });
  }

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

  const dropdown =
    open && position && typeof document !== 'undefined'
      ? createPortal(
          <div
            ref={dropdownRef}
            style={{ position: 'fixed', top: position.top, right: position.right }}
            className="z-50 w-[min(25rem,calc(100vw-2rem))] overflow-hidden rounded-[1.75rem] border border-stone-200 bg-white shadow-2xl shadow-stone-900/15 dark:border-stone-700 dark:bg-stone-900"
          >
            <div className="flex items-start justify-between gap-3 border-b border-stone-100 bg-stone-50/80 px-4 py-3 dark:border-stone-700 dark:bg-stone-950/40">
              <div>
                <p className="font-serif text-xl text-stone-950">Уведомления</p>
                <p className="mt-0.5 text-xs text-stone-500">
                  {badgeCount > 0 ? `${badgeCount} требуют внимания` : 'Все рабочие события на месте'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {unreadCount > 0 && (
                  <button type="button" onClick={markAllRead} className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-brand shadow-sm hover:text-brand-dark dark:bg-stone-800">
                    Прочитать всё
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    router.push('/profile#notifications');
                  }}
                  className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-600 shadow-sm hover:border-brand/30 hover:text-brand dark:border-stone-700 dark:bg-stone-800 dark:text-stone-200"
                >
                  Настройки
                </button>
              </div>
            </div>
            <div className="max-h-[min(32rem,70vh)] overflow-y-auto p-2">
              {matches.length > 0 && (
                <button
                  type="button"
                  onClick={goToMatches}
                  className="block w-full rounded-[1.35rem] bg-gradient-to-r from-brand/15 to-card-sand/40 px-3 py-3 text-left transition hover:from-brand/25 dark:bg-stone-800 dark:bg-none"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[1.1rem] bg-white/80 shadow-sm dark:bg-stone-800">
                      <MatchIcon className="h-6 w-6" />
                    </span>
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-stone-900">
                        Вам подошло {matches.length} {pluralize(matches.length, ['заказ', 'заказа', 'заказов'])}
                      </p>
                      <p className="mt-0.5 break-words text-xs leading-5 text-stone-600">
                        Среднее совпадение {avgCompat}% — нажмите, чтобы откликнуться
                      </p>
                    </div>
                  </div>
                </button>
              )}
              {notifications.map((n) => {
                const meta = notificationMeta(n.eventName);
                const Icon = meta.Icon;
                return (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => openNotification(n)}
                    className={`mt-2 block w-full rounded-[1.35rem] border px-3 py-3 text-left text-sm transition hover:-translate-y-0.5 hover:border-brand/30 hover:bg-stone-50 ${
                      n.read
                        ? 'border-stone-100 bg-white opacity-75 dark:border-stone-700 dark:bg-stone-900'
                        : 'border-brand/20 bg-brand/10 dark:border-brand/30 dark:bg-stone-800'
                    }`}
                  >
                    <div className="flex min-w-0 gap-3">
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[1.1rem] ${meta.tone}`}>
                        <Icon className="h-6 w-6" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="break-words font-semibold text-stone-950">{n.title}</span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${meta.tone}`}>{meta.label}</span>
                        </span>
                        <span className="mt-1 block break-words text-xs leading-5 text-stone-600">{n.message}</span>
                        <span className="mt-2 block text-[11px] font-medium text-stone-400">{formatNotificationTime(n.createdAt)}</span>
                      </span>
                    </div>
                  </button>
                );
              })}
              {notifications.length === 0 && matches.length === 0 && (
                <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
                  <Mascot name="tired" size="h-14 w-14" />
                  <p className="text-sm text-stone-400">Пока пусто — новости появятся тут</p>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        className="relative p-1.5 text-stone-700 transition-transform hover:scale-110 hover:text-brand dark:text-stone-200"
        aria-label="Уведомления"
      >
        <BellIcon className="h-6 w-6" />
        {badgeCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white">
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        )}
      </button>
      {dropdown}
    </div>
  );
}
