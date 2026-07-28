'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, saveTokens } from '@/lib/api';
import { OAuthButtons } from '@/components/OAuthButtons';

type Role = 'CLIENT' | 'FREELANCER';

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!role) return;
    setLoading(true);
    setError(null);

    try {
      const tokens = await api<{ accessToken: string; refreshToken: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, role, displayName }),
      });
      saveTokens(tokens.accessToken, tokens.refreshToken);
      router.push(`/onboarding?role=${role}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Что-то пошло не так');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
      <h1 className="mb-6 text-2xl font-bold">Регистрация на TaskHunt</h1>

      {/* Шаг 1: выбор роли — определяет дальнейшую анкету/квиз */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setRole('CLIENT')}
          className={`rounded-xl border p-4 text-left transition ${
            role === 'CLIENT' ? 'border-brand bg-indigo-50 ring-2 ring-brand' : 'border-slate-300 hover:border-brand'
          }`}
        >
          <div className="text-lg font-semibold">Я заказчик</div>
          <div className="text-sm text-slate-500">Хочу найти исполнителя для задачи</div>
        </button>
        <button
          type="button"
          onClick={() => setRole('FREELANCER')}
          className={`rounded-xl border p-4 text-left transition ${
            role === 'FREELANCER'
              ? 'border-brand bg-indigo-50 ring-2 ring-brand'
              : 'border-slate-300 hover:border-brand'
          }`}
        >
          <div className="text-lg font-semibold">Я фрилансер</div>
          <div className="text-sm text-slate-500">Хочу брать заказы и зарабатывать</div>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="text"
          placeholder="Имя, как будут видеть другие"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="rounded-lg border border-slate-300 px-4 py-3"
        />
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
          placeholder="Пароль (мин. 8 символов)"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-slate-300 px-4 py-3"
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={!role || loading}
          className="rounded-lg bg-brand px-4 py-3 font-medium text-white disabled:opacity-50"
        >
          {loading ? 'Создаём аккаунт...' : 'Продолжить'}
        </button>
      </form>

      <div className="mt-6">
        <OAuthButtons role={role} />
      </div>
    </main>
  );
}
