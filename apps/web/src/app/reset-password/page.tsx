'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';

function ResetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      await api('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, newPassword }) });
      setDone(true);
      setTimeout(() => router.push('/login'), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сбросить пароль');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="text-center">
        <h1 className="mb-3 text-2xl font-bold">Ссылка недействительна</h1>
        <p className="mb-6 text-slate-600">В ссылке нет токена сброса — запросите новую.</p>
        <Link href="/forgot-password" className="rounded-lg border border-slate-300 px-6 py-3 font-medium hover:bg-slate-50">
          Запросить снова
        </Link>
      </div>
    );
  }

  if (done) {
    return <p className="text-emerald-600">Пароль обновлён, перенаправляем на вход…</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
      <h1 className="mb-2 text-2xl font-bold">Новый пароль</h1>
      <input
        type="password"
        placeholder="Новый пароль (мин. 8 символов)"
        required
        minLength={8}
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        className="rounded-lg border border-slate-300 px-4 py-3"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-brand px-4 py-3 font-medium text-white disabled:opacity-50"
      >
        {loading ? 'Сохраняем…' : 'Сохранить пароль'}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Suspense fallback={<p className="text-slate-500">Загрузка…</p>}>
        <ResetPasswordForm />
      </Suspense>
    </main>
  );
}
