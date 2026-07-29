'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, saveTokens } from '@/lib/api';
import { OAuthButtons } from '@/components/OAuthButtons';
import { Logo } from '@/components/Logo';
import { ClientIcon } from '@/components/icons/illustrated/ClientIcon';
import { FreelancerIcon } from '@/components/icons/illustrated/FreelancerIcon';

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
      <Link href="/" className="mb-8 inline-flex w-fit transition-transform hover:scale-105">
        <Logo className="h-9" />
      </Link>
      <h1 className="mb-6 font-serif text-2xl text-stone-900">Регистрация на TuskHunt</h1>

      {/* Шаг 1: выбор роли — определяет дальнейшую анкету/квиз */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setRole('CLIENT')}
          className={`group flex flex-col items-start gap-2 rounded-2xl bg-card-sand p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
            role === 'CLIENT' ? 'ring-2 ring-brand ring-offset-2 ring-offset-cream' : ''
          }`}
        >
          <div
            className={`flex h-14 w-14 items-center justify-center transition-transform duration-300 ${role === 'CLIENT' ? 'animate-wiggle' : 'group-hover:animate-wiggle'}`}
          >
            <ClientIcon className="h-14 w-14" />
          </div>
          <div className="text-base font-semibold text-stone-900">Я заказчик</div>
          <div className="text-xs text-stone-600">Хочу найти исполнителя для задачи</div>
        </button>
        <button
          type="button"
          onClick={() => setRole('FREELANCER')}
          className={`group flex flex-col items-start gap-2 rounded-2xl bg-card-sage p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
            role === 'FREELANCER' ? 'ring-2 ring-brand ring-offset-2 ring-offset-cream' : ''
          }`}
        >
          <div
            className={`flex h-14 w-14 items-center justify-center transition-transform duration-300 ${role === 'FREELANCER' ? 'animate-wiggle' : 'group-hover:animate-wiggle'}`}
          >
            <FreelancerIcon className="h-14 w-14" />
          </div>
          <div className="text-base font-semibold text-stone-900">Я фрилансер</div>
          <div className="text-xs text-stone-600">Хочу брать заказы и зарабатывать</div>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="text"
          placeholder="Имя, как будут видеть другие"
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className="rounded-lg border border-stone-300 px-4 py-3"
        />
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
          placeholder="Пароль (мин. 8 символов)"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-stone-300 px-4 py-3"
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
