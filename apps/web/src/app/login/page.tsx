'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, saveTokens } from '@/lib/api';
import type { LoginResponse } from '@/lib/types';
import { OAuthButtons } from '@/components/OAuthButtons';
import { Logo } from '@/components/Logo';
import { Mascot } from '@/components/Mascot';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [totpToken, setTotpToken] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState('');

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const result = await api<LoginResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      if ('requiresTotp' in result) {
        setTotpToken(result.totpToken);
      } else {
        saveTokens(result.accessToken, result.refreshToken);
        router.push('/dashboard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось войти');
    } finally {
      setLoading(false);
    }
  }

  async function handleVerifyTotp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!totpToken) return;
    setLoading(true);
    setError(null);
    try {
      const tokens = await api<{ accessToken: string; refreshToken: string }>('/auth/2fa/verify', {
        method: 'POST',
        body: JSON.stringify({ totpToken, code: totpCode }),
      });
      saveTokens(tokens.accessToken, tokens.refreshToken);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Неверный код');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <Link href="/" className="mb-8 inline-flex w-fit transition-transform hover:scale-105">
        <Logo className="h-9" />
      </Link>
      <div className="mb-6 flex items-center gap-3">
        <Mascot name="hello" size="h-14 w-14" />
        <h1 className="text-2xl font-bold">С возвращением</h1>
      </div>

      {totpToken ? (
        <form onSubmit={handleVerifyTotp} className="flex flex-col gap-4">
          <p className="text-sm text-stone-600">Введите код из приложения-аутентификатора или один из резервных кодов.</p>
          <input
            required
            inputMode="numeric"
            autoFocus
            placeholder="Код"
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value)}
            className="rounded-lg border border-stone-300 px-4 py-3"
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-brand px-4 py-3 font-medium text-white disabled:opacity-50"
          >
            {loading ? 'Проверяем...' : 'Подтвердить'}
          </button>
          <button
            type="button"
            onClick={() => {
              setTotpToken(null);
              setTotpCode('');
            }}
            className="text-sm text-stone-500 hover:text-stone-700"
          >
            ← Назад
          </button>
        </form>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              type="email"
              placeholder="Email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-lg border border-stone-300 px-4 py-3"
            />
            <input
              type="password"
              placeholder="Пароль"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-lg border border-stone-300 px-4 py-3"
            />

            <Link href="/forgot-password" className="text-right text-sm text-stone-500 hover:text-brand">
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

          <p className="mt-6 text-sm text-stone-500">
            Нет аккаунта?{' '}
            <Link href="/register" className="font-medium text-brand hover:text-brand-dark">
              Зарегистрироваться
            </Link>
          </p>
        </>
      )}
    </main>
  );
}
