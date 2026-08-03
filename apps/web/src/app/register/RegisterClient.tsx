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

export default function RegisterClient() {
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
      title="Создайте аккаунт и сразу начните работу"
      description="Выберите роль, заполните три поля и переходите к короткой настройке профиля. Роль можно сменить до отправки формы."
      sideTitle="Два сценария в одной системе: нанимайте и выполняйте безопасно"
    >
      <div className="mb-2 grid gap-2 sm:mb-3">
        <button
          type="button"
          onClick={() => setRole('CLIENT')}
          aria-pressed={role === 'CLIENT'}
          className={`interactive-card group flex min-h-[64px] w-full items-center gap-2 rounded-[1.15rem] bg-card-sand p-2.5 text-left sm:min-h-[78px] sm:gap-3 sm:rounded-[1.25rem] sm:p-3 ${
            role === 'CLIENT' ? 'ring-2 ring-brand ring-offset-2 ring-offset-cream' : ''
          }`}
        >
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center transition-transform duration-300 sm:h-12 sm:w-12 ${role === 'CLIENT' ? 'animate-wiggle' : 'group-hover:animate-wiggle'}`}
          >
            <ClientIcon className="h-9 w-9 sm:h-12 sm:w-12" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-stone-900">Заказчик</div>
            <div className="text-xs leading-4 text-stone-600 sm:mt-1">Найти исполнителя</div>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setRole('FREELANCER')}
          aria-pressed={role === 'FREELANCER'}
          className={`interactive-card group flex min-h-[64px] w-full items-center gap-2 rounded-[1.15rem] bg-card-sage p-2.5 text-left sm:min-h-[78px] sm:gap-3 sm:rounded-[1.25rem] sm:p-3 ${
            role === 'FREELANCER' ? 'ring-2 ring-brand ring-offset-2 ring-offset-cream' : ''
          }`}
        >
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center transition-transform duration-300 sm:h-12 sm:w-12 ${role === 'FREELANCER' ? 'animate-wiggle' : 'group-hover:animate-wiggle'}`}
          >
            <FreelancerIcon className="h-9 w-9 sm:h-12 sm:w-12" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-stone-900">Фрилансер</div>
            <div className="text-xs leading-4 text-stone-600 sm:mt-1">Брать заказы</div>
          </div>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="flex w-full flex-col gap-2.5 sm:gap-3">
        <div className="grid w-full gap-2.5 sm:gap-3">
          <label className="grid w-full min-w-0 gap-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-500 sm:text-xs">Имя</span>
            <input
              type="text"
              placeholder="Как вас увидят другие"
              required
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="field-surface w-full px-3 py-2 sm:px-4 sm:py-2.5"
            />
          </label>
          <label className="grid w-full min-w-0 gap-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-500 sm:text-xs">Email</span>
            <input
              type="email"
              placeholder="name@taskhunt.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="field-surface w-full px-3 py-2 sm:px-4 sm:py-2.5"
            />
          </label>
          <label className="grid w-full min-w-0 gap-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-stone-500 sm:text-xs">Пароль</span>
            <input
              type="password"
              placeholder="Мин. 8 символов"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="field-surface w-full px-3 py-2 sm:px-4 sm:py-2.5"
            />
          </label>
        </div>
        <div>
          <div className="h-1.5 overflow-hidden rounded-full bg-stone-100">
            <div className={`h-full rounded-full transition-all duration-300 ${passwordStrength.bar}`} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-stone-500">
            <span>{passwordStrength.label}</span>
            <span>{passwordStrength.score}/5</span>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button type="submit" disabled={!role || loading} className="primary-action px-4 py-2 sm:py-2.5">
          {loading ? 'Создаём аккаунт...' : 'Продолжить'}
        </button>
      </form>

      <div className="mt-2.5 sm:mt-4">
        <OAuthButtons role={role} />
      </div>

      <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2 rounded-[1.2rem] bg-white/72 px-3 py-1.5 text-sm shadow-sm sm:mt-3 sm:py-2">
        <span className="font-medium text-stone-600">Уже есть аккаунт?</span>
        <Link href="/login" className="font-bold text-brand hover:text-brand-dark">
          Войти
        </Link>
      </div>
    </AuthShell>
  );
}
