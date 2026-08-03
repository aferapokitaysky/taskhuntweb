'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useRequireAuth } from '@/lib/useRequireAuth';
import type { Category, MarketplaceRole, User } from '@/lib/types';
import { Mascot } from '@/components/Mascot';
import { Logo } from '@/components/Logo';

export default function OnboardingPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-2xl px-4 py-12 text-stone-500">Загружаем анкету...</main>}>
      <OnboardingForm />
    </Suspense>
  );
}

function OnboardingForm() {
  useRequireAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = useMemo<MarketplaceRole>(() => {
    return searchParams.get('role') === 'FREELANCER' ? 'FREELANCER' : 'CLIENT';
  }, [searchParams]);

  const [step, setStep] = useState(1);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  // Сколько ниш показано на категорию — открывается только у выбранных
  // категорий (см. рендер step 1), иначе на IT-категории пришлось бы
  // рисовать все 400+ ниш одним полотном сразу при заходе на онбординг.
  const [nicheLimits, setNicheLimits] = useState<Record<string, number>>({});
  const NICHE_PAGE_SIZE = 20;
  const [experienceLevel, setExperienceLevel] = useState('middle');
  const [availability, setAvailability] = useState('part_time');
  const [expectedRateMin, setExpectedRateMin] = useState('');
  const [primaryGoal, setPrimaryGoal] = useState('Найти исполнителя для задачи');
  const [expectedBudgetMin, setExpectedBudgetMin] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Заполняется, только если после онбординга аккаунт всё ещё
  // PENDING_VERIFICATION (локальная регистрация email+пароль) — тогда вместо
  // автоперехода показываем отдельный экран "подтвердите почту". OAuth-вход
  // и уже подтверждённые аккаунты этот экран не видят.
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);

  useEffect(() => {
    api<Category[]>('/categories')
      .then(setCategories)
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить категории'));
  }, []);

  const lastStep = role === 'FREELANCER' ? 3 : 2;

  function toggleCategory(id: string) {
    setSelectedCategories((current) =>
      current.includes(id) ? current.filter((categoryId) => categoryId !== id) : [...current, id],
    );
  }

  async function submit() {
    setLoading(true);
    setError(null);

    const body =
      role === 'FREELANCER'
        ? {
            experienceLevel,
            interestedCategoryIds: selectedCategories,
            expectedRateMin: Number(expectedRateMin),
            availability,
            structuredAnswers: { source: 'onboarding' },
          }
        : {
            primaryGoal,
            interestedCategoryIds: selectedCategories,
            expectedBudgetMin: Number(expectedBudgetMin),
            structuredAnswers: { source: 'onboarding' },
          };

    try {
      await api('/users/me/onboarding', { method: 'POST', body: JSON.stringify(body) });
      const me = await api<User>('/users/me').catch(() => null);
      setDone(true);
      if (me?.status === 'PENDING_VERIFICATION') {
        setPendingEmail(me.email);
      } else {
        setTimeout(() => router.push('/dashboard'), 1400);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить анкету');
      setLoading(false);
    }
  }

  async function resendVerification() {
    setResending(true);
    setResendError(null);
    try {
      await api('/auth/resend-verification', { method: 'POST' });
      setResent(true);
    } catch (err) {
      setResendError(err instanceof Error ? err.message : 'Не удалось отправить письмо');
    } finally {
      setResending(false);
    }
  }

  if (done && pendingEmail) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 py-12 text-center">
        <Mascot name="celebrate" size="h-28 w-28" />
        <h1 className="mt-4 font-serif text-2xl text-stone-900">Подтвердите почту</h1>
        <p className="mt-2 text-stone-600">
          Мы отправили письмо со ссылкой для подтверждения на <span className="font-semibold text-stone-900">{pendingEmail}</span>. Перейдите по
          ней, чтобы полностью активировать аккаунт — а пока можно уже пользоваться личным кабинетом.
        </p>

        {resent && <p className="mt-4 text-sm font-semibold text-emerald-600">Письмо отправлено ещё раз.</p>}
        {resendError && <p className="mt-4 text-sm text-red-600">{resendError}</p>}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={resendVerification}
            disabled={resending || resent}
            className="secondary-action px-5 py-2.5 text-sm disabled:opacity-50"
          >
            {resending ? 'Отправляем…' : resent ? 'Отправлено' : 'Отправить письмо ещё раз'}
          </button>
          <button type="button" onClick={() => router.push('/dashboard')} className="primary-action px-6 py-2.5 text-sm">
            Перейти в кабинет
          </button>
        </div>
      </main>
    );
  }

  if (done) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-4 py-12 text-center">
        <Mascot name="celebrate" size="h-28 w-28" />
        <h1 className="mt-4 font-serif text-2xl text-stone-900">Готово!</h1>
        <p className="mt-2 text-stone-600">Анкета сохранена, переносим вас в личный кабинет…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 py-6">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-6xl overflow-hidden rounded-[2rem] bg-white shadow-2xl shadow-stone-200/70 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="bg-stone-950 p-6 text-white lg:p-8">
          <Logo className="h-10" />
          <div className="mt-10">
            <Mascot name="wave" size="h-24 w-24" />
            <p className="mt-6 text-sm font-medium text-brand-light">{role === 'FREELANCER' ? 'Профиль исполнителя' : 'Профиль заказчика'}</p>
            <h1 className="mt-2 font-serif text-3xl leading-tight">Настроим рекомендации под вас</h1>
            <p className="mt-4 text-sm leading-6 text-stone-300">
              Эти ответы помогают сортировать заказы, исполнителей и уведомления так, чтобы вы видели полезное раньше шума.
            </p>
          </div>
          <div className="mt-8 space-y-3">
            {Array.from({ length: lastStep }).map((_, i) => {
              const n = i + 1;
              return (
                <div key={n} className={`rounded-2xl px-4 py-3 text-sm ${step === n ? 'bg-white text-stone-950' : 'bg-white/10 text-stone-300'}`}>
                  Шаг {n}: {n === 1 ? 'интересы' : role === 'CLIENT' ? 'задачи и бюджет' : n === 2 ? 'уровень' : 'ставка'}
                </div>
              );
            })}
          </div>
        </aside>

        <section className="flex flex-col justify-center p-5 sm:p-8 lg:p-12">
          <div className="mb-8">
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="font-semibold text-brand">Шаг {step} из {lastStep}</span>
              <span className="text-stone-400">{Math.round((step / lastStep) * 100)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-stone-100">
              <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${(step / lastStep) * 100}%` }} />
            </div>
          </div>

      <div className="premium-panel reveal-in rounded-[2rem] bg-cream-50 p-5 sm:p-7">
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="font-serif text-2xl text-stone-950">Выберите интересные категории</h2>
              <p className="mt-2 text-sm text-stone-600">Можно выбрать несколько — по ним строятся рекомендации и быстрые фильтры.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => toggleCategory(category.id)}
                  className={`interactive-card rounded-2xl border px-4 py-3 text-left text-sm font-medium ${
                    selectedCategories.includes(category.id)
                      ? 'border-brand bg-brand/10 text-brand shadow-sm'
                      : 'border-stone-200 bg-white hover:border-brand'
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>

            {categories
              .filter((category) => selectedCategories.includes(category.id) && (category.children?.length ?? 0) > 0)
              .map((category) => {
                const niches = category.children!;
                const limit = nicheLimits[category.id] ?? NICHE_PAGE_SIZE;
                const visibleNiches = niches.slice(0, limit);
                const remaining = niches.length - visibleNiches.length;
                return (
                  <div key={category.id} className="rounded-2xl border border-stone-100 bg-white/60 p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-400">Ниши — {category.name}</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {visibleNiches.map((niche) => (
                        <button
                          key={niche.id}
                          type="button"
                          onClick={() => toggleCategory(niche.id)}
                          className={`interactive-card rounded-2xl border px-4 py-2.5 text-left text-sm font-medium ${
                            selectedCategories.includes(niche.id)
                              ? 'border-brand bg-brand/10 text-brand shadow-sm'
                              : 'border-stone-200 bg-white hover:border-brand'
                          }`}
                        >
                          {niche.name}
                        </button>
                      ))}
                    </div>
                    {remaining > 0 && (
                      <button
                        type="button"
                        onClick={() => setNicheLimits((current) => ({ ...current, [category.id]: limit + NICHE_PAGE_SIZE }))}
                        className="secondary-action mt-3 px-4 py-2 text-xs"
                      >
                        Показать ещё ({remaining})
                      </button>
                    )}
                  </div>
                );
              })}
          </div>
        )}

        {step === 2 && role === 'CLIENT' && (
          <div className="space-y-4">
            <div>
              <h2 className="font-serif text-2xl text-stone-950">Какой тип задач планируете размещать?</h2>
              <p className="mt-2 text-sm text-stone-600">Это помогает подсказать структуру заказа и рекомендованный бюджет.</p>
            </div>
            <select
              value={primaryGoal}
              onChange={(e) => setPrimaryGoal(e.target.value)}
              className="field-surface w-full px-4 py-3"
            >
              <option>Найти исполнителя для задачи</option>
              <option>Нанять команду</option>
              <option>Регулярно отдавать задачи на аутсорс</option>
            </select>
            <input
              type="number"
              min="1"
              placeholder="Обычный бюджет заказа, USD"
              value={expectedBudgetMin}
              onChange={(e) => setExpectedBudgetMin(e.target.value)}
              className="field-surface w-full px-4 py-3"
            />
          </div>
        )}

        {step === 2 && role === 'FREELANCER' && (
          <div className="space-y-4">
            <div>
              <h2 className="font-serif text-2xl text-stone-950">Ваш уровень</h2>
              <p className="mt-2 text-sm text-stone-600">Уровень влияет на подбор заказов и ожидания заказчика.</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {['junior', 'middle', 'senior'].map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setExperienceLevel(level)}
                  className={`interactive-card rounded-2xl border px-3 py-4 text-sm font-semibold ${
                    experienceLevel === level ? 'border-brand bg-brand/10 text-brand shadow-sm' : 'border-stone-200 bg-white hover:border-brand'
                  }`}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 3 && role === 'FREELANCER' && (
          <div className="space-y-4">
            <div>
              <h2 className="font-serif text-2xl text-stone-950">Ставка и доступность</h2>
              <p className="mt-2 text-sm text-stone-600">Покажем заказы, которые реально подходят по формату и ожиданиям.</p>
            </div>
            <input
              type="number"
              min="1"
              placeholder="Минимальная ставка, USD"
              value={expectedRateMin}
              onChange={(e) => setExpectedRateMin(e.target.value)}
              className="field-surface w-full px-4 py-3"
            />
            <select
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
              className="field-surface w-full px-4 py-3"
            >
              <option value="full_time">Full-time</option>
              <option value="part_time">Part-time</option>
              <option value="occasional">Occasional</option>
            </select>
          </div>
        )}

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex justify-between gap-3">
          <button
            type="button"
            onClick={() => setStep((current) => Math.max(1, current - 1))}
            disabled={step === 1 || loading}
            className="secondary-action px-5 py-3 disabled:opacity-40"
          >
            Назад
          </button>
          {step < lastStep ? (
            <button
              type="button"
              onClick={() => setStep((current) => Math.min(lastStep, current + 1))}
              className="primary-action px-5 py-3"
            >
              Далее
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={loading}
              className="primary-action px-5 py-3"
            >
              {loading ? 'Сохраняем...' : 'В dashboard'}
            </button>
          )}
        </div>
      </div>
        </section>
      </div>
    </main>
  );
}
