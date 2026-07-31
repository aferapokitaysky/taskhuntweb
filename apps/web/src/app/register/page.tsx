'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { api, saveTokens } from '@/lib/api';
import { OAuthButtons } from '@/components/OAuthButtons';
import { AuthShell } from '@/components/AuthShell';
import { ClientIcon } from '@/components/icons/illustrated/ClientIcon';
import { FreelancerIcon } from '@/components/icons/illustrated/FreelancerIcon';

type Role = 'CLIENT' | 'FREELANCER';

function getPasswordStrength(password: string) {
  const checks = [
    password.length >= 8,
    /[A-ZА-Я]/.test(password),
    /[a-zа-я]/.test(password),
    /\d/.test(password),
    /[^A-Za-zА-Яа-я0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length;
  if (!password) return { score: 0, label: 'Введите пароль', bar: 'w-0 bg-stone-200' };
  if (score <= 2) return { score, label: 'Слабый пароль', bar: 'w-1/3 bg-red-400' };
  if (score <= 4) return { score, label: 'Нормальный пароль', bar: 'w-2/3 bg-amber-400' };
  return { score, label: 'Сильный пароль', bar: 'w-full bg-emerald-500' };
}

export default function RegisterPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-md px-4 py-12 text-stone-500">Загружаем регистрацию...</main>}>
      <RegisterForm />
    </Suspense>
  );
}

function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRole = useMemo<Role | null>(() => {
    const queryRole = searchParams.get('role');
    return queryRole === 'CLIENT' || queryRole === 'FREELANCER' ? queryRole : null;
  }, [searchParams]);
  const [role, setRole] = useState<Role | null>(initialRole);
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const passwordStrength = getPasswordStrength(password);

  useEffect(() => {
    setRole(initialRole);
  }, [initialRole]);

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
    <AuthShell
      eyebrow="Новый аккаунт"
      title="Создайте профиль под вашу роль"
      description="Сначала выберите сценарий: нанимать исполнителей или брать заказы. После регистрации короткая анкета настроит рекомендации."
      sideTitle="Два сценария в одной системе: нанимайте и выполняйте безопасно"
    >
      {/* Шаг 1: выбор роли — определяет дальнейшую анкету/квиз */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setRole('CLIENT')}
          aria-pressed={role === 'CLIENT'}
          className={`interactive-card group flex flex-col items-start gap-2 rounded-2xl bg-card-sand p-4 text-left ${
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
          aria-pressed={role === 'FREELANCER'}
          className={`interactive-card group flex flex-col items-start gap-2 rounded-2xl bg-card-sage p-4 text-left ${
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
          className="field-surface px-4 py-3"
        />
        <input
          type="email"
          placeholder="Email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="field-surface px-4 py-3"
        />
        <input
          type="password"
          placeholder="Пароль (мин. 8 символов)"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="field-surface px-4 py-3"
        />
        <div className="-mt-2">
          <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
            <div className={`h-full rounded-full transition-all duration-300 ${passwordStrength.bar}`} />
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
            <span>{passwordStrength.label}</span>
            <span>{passwordStrength.score}/5</span>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={!role || loading}
          className="primary-action px-4 py-3"
        >
          {loading ? 'Создаём аккаунт...' : 'Продолжить'}
        </button>
      </form>

      <div className="mt-6">
        <OAuthButtons role={role} />
      </div>
      <p className="mt-6 text-sm text-stone-500">
        Уже есть аккаунт?{' '}
        <Link href="/login" className="font-semibold text-brand hover:text-brand-dark">
          Войти
        </Link>
      </p>
    </AuthShell>
  );
}
