'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, saveTokens } from '@/lib/api';
import type { LoginResponse } from '@/lib/types';
import { OAuthButtons } from '@/components/OAuthButtons';
import { AuthShell } from '@/components/AuthShell';

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
    <AuthShell
      eyebrow="Вход в рабочее пространство"
      title="Продолжайте сделки без потери контекста"
      description="Заказы, отклики, инвойсы, уведомления и выплаты ждут в личном кабинете. Если включена 2FA, попросим код на следующем шаге."
    >
      {totpToken ? (
        <form onSubmit={handleVerifyTotp} className="flex w-full flex-col gap-3">
          <p className="text-sm text-stone-600">Введите код из приложения-аутентификатора или один из резервных кодов.</p>
          <input
            required
            inputMode="numeric"
            autoFocus
            placeholder="Код"
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value)}
            className="field-surface w-full px-4 py-2.5"
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="primary-action px-4 py-2.5"
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
          <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3">
            <label className="grid w-full gap-1.5">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-stone-500">Email</span>
              <input
                type="email"
                placeholder="admin@taskhunt.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="field-surface w-full px-4 py-2.5"
              />
            </label>
            <label className="grid w-full gap-1.5">
              <span className="text-xs font-bold uppercase tracking-[0.14em] text-stone-500">Пароль</span>
              <input
                type="password"
                placeholder="Введите пароль"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field-surface w-full px-4 py-2.5"
              />
            </label>

            <Link href="/forgot-password" className="self-end text-sm text-stone-500 hover:text-brand">
              Забыли пароль?
            </Link>

            {error && <p className="rounded-[1.1rem] bg-card-rose px-3 py-2 text-sm font-medium text-red-700">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="primary-action px-4 py-2.5"
            >
              {loading ? 'Входим...' : 'Войти'}
            </button>
          </form>

          <div className="mt-3">
            <OAuthButtons />
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 rounded-[1.2rem] bg-white/72 px-3 py-2 text-sm shadow-sm">
            <span className="font-medium text-stone-600">Нет аккаунта на TaskHunt?</span>
            <Link href="/register" className="font-bold text-brand hover:text-brand-dark">
              Зарегистрироваться
            </Link>
          </div>
        </>
      )}
    </AuthShell>
  );
}
