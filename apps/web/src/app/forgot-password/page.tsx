'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Logo } from '@/components/Logo';
import { AccessIcon } from '@/components/icons/illustrated/AccessIcon';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось отправить запрос');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 py-12">
      <Link href="/" className="mb-6 inline-flex w-fit transition-transform hover:scale-105">
        <Logo className="h-9" />
      </Link>

      <div className="w-full rounded-3xl bg-white p-8 text-center shadow-sm">
        <Link
          href="/login"
          className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-stone-500 hover:text-stone-900"
        >
          ← Назад ко входу
        </Link>

        <div className="mx-auto mb-4 flex h-16 w-16 animate-float items-center justify-center">
          <AccessIcon className="h-16 w-16" />
        </div>
        <h1 className="mb-2 font-serif text-2xl text-stone-900">Восстановление пароля</h1>
        <p className="mb-6 text-sm text-stone-500">Пришлём ссылку для сброса пароля на указанный email.</p>

        {sent ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Если такой email зарегистрирован, на него отправлена ссылка для сброса пароля.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-left">
            <input
              type="email"
              placeholder="Email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-stone-300 px-4 py-3"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-brand px-4 py-3 font-medium text-white transition hover:bg-brand-dark disabled:opacity-50"
            >
              {loading ? 'Отправляем…' : 'Отправить ссылку'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
