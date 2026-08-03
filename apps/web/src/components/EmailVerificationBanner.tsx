'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

/** Показывается в шапке, пока у пользователя status === 'PENDING_VERIFICATION'. */
export function EmailVerificationBanner() {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function resend() {
    setSending(true);
    setError(null);
    try {
      await api('/auth/resend-verification', { method: 'POST' });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить письмо');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="relative left-1/2 right-1/2 z-20 mb-6 flex w-screen -translate-x-1/2 justify-center px-4">
      <div className="flex w-full max-w-[1500px] flex-wrap items-center justify-between gap-3 rounded-[1.5rem] border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
        <span>Подтвердите email, чтобы разблокировать все возможности аккаунта — при регистрации мы отправили ссылку на почту.</span>
        <div className="flex shrink-0 items-center gap-3">
          {sent && <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">Письмо отправлено</span>}
          {error && <span className="text-xs font-semibold text-red-600">{error}</span>}
          <button
            type="button"
            onClick={resend}
            disabled={sending || sent}
            className="secondary-action shrink-0 rounded-full px-4 py-2 text-xs disabled:opacity-50"
          >
            {sending ? 'Отправляем…' : sent ? 'Отправлено' : 'Отправить ещё раз'}
          </button>
        </div>
      </div>
    </div>
  );
}
