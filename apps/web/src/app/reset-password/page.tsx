'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { AuthShell } from '@/components/AuthShell';
import { AccessIcon } from '@/components/icons/illustrated/AccessIcon';

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
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center opacity-60">
          <AccessIcon className="h-16 w-16" />
        </div>
        <h1 className="mb-3 font-serif text-2xl text-stone-900">Ссылка недействительна</h1>
        <p className="mb-6 text-stone-600">В ссылке нет токена сброса — запросите новую.</p>
        <Link href="/forgot-password" className="secondary-action inline-flex px-6 py-3">
          Запросить снова
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="text-center">
        <AccessIcon className="mx-auto h-16 w-16" />
        <p className="mt-4 font-semibold text-emerald-600">Пароль обновлён, перенаправляем на вход…</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-4">
      <div className="mx-auto flex h-16 w-16 animate-float items-center justify-center">
        <AccessIcon className="h-16 w-16" />
      </div>
      <h1 className="mb-2 text-center font-serif text-2xl text-stone-900">Новый пароль</h1>
      <input
        type="password"
        placeholder="Новый пароль (мин. 8 символов)"
        required
        minLength={8}
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        className="field-surface px-4 py-3"
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="primary-action px-4 py-3"
      >
        {loading ? 'Сохраняем…' : 'Сохранить пароль'}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell
      eyebrow="Новый пароль"
      title="Создайте новый ключ доступа"
      description="Минимум 8 символов. После смены пароля вернём вас на страницу входа."
      sideTitle="Контроль доступа встроен в тот же продуктовый поток"
    >
      <Suspense fallback={<p className="text-center text-stone-500">Загрузка…</p>}>
        <ResetPasswordForm />
      </Suspense>
    </AuthShell>
  );
}
