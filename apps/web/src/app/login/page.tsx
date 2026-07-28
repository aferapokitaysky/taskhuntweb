'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, saveTokens } from '@/lib/api';
import type { AuthTokens } from '@/lib/types';
import { OAuthButtons } from '@/components/OAuthButtons';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const tokens = await api<AuthTokens>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      saveTokens(tokens.accessToken, tokens.refreshToken);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось войти');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <Link href="/" className="mb-8 text-sm font-medium text-slate-500 hover:text-slate-900">
        TaskHunt
      </Link>
      <h1 className="mb-6 text-2xl font-bold">Вход</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="email"
          placeholder="Email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-slate-300 px-4 py-3"
        />
        <input
          type="password"
          placeholder="Пароль"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-slate-300 px-4 py-3"
        />

        <Link href="/forgot-password" className="text-right text-sm text-slate-500 hover:text-brand">
          Забыли пароль?
        </Link>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-brand px-4 py-3 font-medium text-white disabled:opacity-50"
        >
          {loading ? 'Входим...' : 'Войти'}
        </button>
      </form>

      <div className="mt-6">
        <OAuthButtons />
      </div>

      <p className="mt-6 text-sm text-slate-500">
        Нет аккаунта?{' '}
        <Link href="/register" className="font-medium text-brand hover:text-brand-dark">
          Зарегистрироваться
        </Link>
      </p>
    </main>
  );
}
