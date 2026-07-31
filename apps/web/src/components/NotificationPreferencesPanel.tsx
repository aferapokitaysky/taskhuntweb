'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { User } from '@/lib/types';
import { BellIcon } from './icons/BellIcon';
import { MailCheckIcon } from './icons/illustrated/MailCheckIcon';
import { SupportNavIcon } from './icons/illustrated/SupportNavIcon';

type NotificationChannel = 'PUSH' | 'EMAIL' | 'TELEGRAM' | 'IN_APP' | 'SMS';
type DigestFrequency = 'NONE' | 'DAILY' | 'WEEKLY';

interface Preference {
  channel: NotificationChannel;
  enabled: boolean;
}

const CHANNEL_LABELS: Record<NotificationChannel, { title: string; description: string }> = {
  IN_APP: { title: 'Внутри TaskHunt', description: 'Колокольчик, отклики, счета, сдача работы и споры.' },
  EMAIL: { title: 'Email', description: 'Важные события и итоговые подборки на почту.' },
  TELEGRAM: { title: 'Telegram', description: 'Быстрые рабочие сигналы, когда бот будет подключён.' },
  PUSH: { title: 'Push', description: 'Мгновенные уведомления в браузере и приложении.' },
  SMS: { title: 'SMS', description: 'Только критичные финансовые и спорные события.' },
};

const DIGEST_OPTIONS: { value: DigestFrequency; label: string; description: string }[] = [
  { value: 'NONE', label: 'Без дайджеста', description: 'Только обычные события.' },
  { value: 'DAILY', label: 'Ежедневно', description: 'Сводка активностей раз в день.' },
  { value: 'WEEKLY', label: 'Еженедельно', description: 'Спокойная недельная сводка.' },
];

export function NotificationPreferencesPanel() {
  const [preferences, setPreferences] = useState<Preference[]>([]);
  const [digest, setDigest] = useState<DigestFrequency | null>(null);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api<Preference[]>('/notifications/preferences'),
      api<User>('/users/me').catch(() => null),
    ])
      .then(([rows, me]) => {
        const order: NotificationChannel[] = ['IN_APP', 'EMAIL', 'TELEGRAM', 'PUSH', 'SMS'];
        setPreferences([...rows].sort((a, b) => order.indexOf(a.channel) - order.indexOf(b.channel)));
        setDigest(me?.digestFrequency ?? 'NONE');
      })
      .catch(() => setError('Не удалось загрузить настройки уведомлений'));
  }, []);

  async function togglePreference(channel: NotificationChannel, enabled: boolean) {
    setError(null);
    setSavingKey(channel);
    setPreferences((current) => current.map((item) => (item.channel === channel ? { ...item, enabled } : item)));
    try {
      await api('/notifications/preferences', { method: 'PATCH', body: JSON.stringify({ channel, enabled }) });
    } catch (err) {
      setPreferences((current) => current.map((item) => (item.channel === channel ? { ...item, enabled: !enabled } : item)));
      setError(err instanceof Error ? err.message : 'Не удалось сохранить канал');
    } finally {
      setSavingKey(null);
    }
  }

  async function updateDigest(next: DigestFrequency) {
    setError(null);
    setSavingKey(`digest-${next}`);
    const previous = digest;
    setDigest(next);
    try {
      await api('/notifications/preferences/digest', { method: 'PATCH', body: JSON.stringify({ frequency: next }) });
    } catch (err) {
      setDigest(previous);
      setError(err instanceof Error ? err.message : 'Не удалось сохранить дайджест');
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <section id="notifications" className="premium-panel scroll-mt-28 overflow-hidden p-0">
      <div className="border-b border-stone-100 bg-gradient-to-br from-card-sage/45 via-white to-card-sand/55 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand">Уведомления</p>
            <h2 className="mt-1 font-serif text-2xl text-stone-950">События, которые нельзя пропустить</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
              Настройте, где получать отклики, счета, оплату, сдачу работы, споры и приглашения в заказы.
            </p>
          </div>
          <span className="flex h-14 w-14 items-center justify-center rounded-[1.25rem] bg-white/80 shadow-sm">
            <MailCheckIcon className="h-9 w-9" />
          </span>
        </div>
      </div>

      <div className="grid gap-5 p-5 md:grid-cols-[1.2fr_0.8fr] md:p-6">
        <div className="space-y-2">
          {preferences.map((item) => {
            const meta = CHANNEL_LABELS[item.channel];
            return (
              <div key={item.channel} className="flex min-w-0 items-center justify-between gap-3 rounded-[1.35rem] border border-stone-100 bg-white/75 p-3">
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold text-stone-950">{meta.title}</p>
                  <p className="mt-0.5 break-words text-xs leading-5 text-stone-500">{meta.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => togglePreference(item.channel, !item.enabled)}
                  disabled={savingKey === item.channel}
                  className={`relative h-8 w-14 shrink-0 rounded-full border transition disabled:opacity-60 ${
                    item.enabled ? 'border-brand bg-brand' : 'border-stone-200 bg-stone-100'
                  }`}
                  aria-pressed={item.enabled}
                >
                  <span
                    className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-sm transition ${
                      item.enabled ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            );
          })}
          {preferences.length === 0 && !error && (
            <div className="rounded-[1.35rem] bg-stone-50 p-4 text-sm text-stone-500">Загружаем настройки...</div>
          )}
        </div>

        <div className="rounded-[1.5rem] bg-stone-50/80 p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-[1rem] bg-white shadow-sm">
              <BellIcon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-stone-950">Дайджест</p>
              <p className="text-xs text-stone-500">Сводка без шума.</p>
            </div>
          </div>
          <div className="grid gap-2">
            {DIGEST_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => updateDigest(option.value)}
                disabled={savingKey === `digest-${option.value}`}
                className={`rounded-[1.15rem] border px-3 py-2 text-left transition disabled:opacity-60 ${
                  digest === option.value
                    ? 'border-brand bg-brand/10 text-brand'
                    : 'border-stone-100 bg-white text-stone-700 hover:border-brand/30'
                }`}
              >
                <span className="block text-xs font-semibold">{option.label}</span>
                <span className="mt-0.5 block break-words text-[11px] leading-4 text-stone-500">{option.description}</span>
              </button>
            ))}
          </div>
          <div className="mt-4 flex gap-2 rounded-[1.25rem] bg-white p-3 text-xs leading-5 text-stone-500">
            <SupportNavIcon className="h-5 w-5 shrink-0" />
            Критичные споры и финансовые события остаются видимыми в колокольчике, даже если внешние каналы выключены.
          </div>
        </div>

        {error && <p className="md:col-span-2 text-sm text-red-600">{error}</p>}
      </div>
    </section>
  );
}
