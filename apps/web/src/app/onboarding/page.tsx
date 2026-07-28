'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import type { Category, MarketplaceRole } from '@/lib/types';

export default function OnboardingPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-2xl px-4 py-12 text-slate-500">Загружаем анкету...</main>}>
      <OnboardingForm />
    </Suspense>
  );
}

function OnboardingForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const role = useMemo<MarketplaceRole>(() => {
    return searchParams.get('role') === 'FREELANCER' ? 'FREELANCER' : 'CLIENT';
  }, [searchParams]);

  const [step, setStep] = useState(1);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [experienceLevel, setExperienceLevel] = useState('middle');
  const [availability, setAvailability] = useState('part_time');
  const [expectedRateMin, setExpectedRateMin] = useState('');
  const [primaryGoal, setPrimaryGoal] = useState('Найти исполнителя для задачи');
  const [expectedBudgetMin, setExpectedBudgetMin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api<Category[]>('/categories')
      .then(setCategories)
      .catch((err) => setError(err instanceof Error ? err.message : 'Не удалось загрузить категории'));
  }, []);

  const flatCategories = categories.flatMap((category) => [category, ...(category.children ?? [])]);
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
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить анкету');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-4 py-12">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-brand">{role === 'FREELANCER' ? 'Фрилансер' : 'Заказчик'}</p>
          <h1 className="text-2xl font-bold">Быстрая анкета</h1>
        </div>
        <span className="text-sm text-slate-500">
          {step}/{lastStep}
        </span>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Выберите интересные категории</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {flatCategories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => toggleCategory(category.id)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm ${
                    selectedCategories.includes(category.id)
                      ? 'border-brand bg-indigo-50 text-brand'
                      : 'border-slate-200 hover:border-brand'
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && role === 'CLIENT' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Какой тип задач планируете размещать?</h2>
            <select
              value={primaryGoal}
              onChange={(e) => setPrimaryGoal(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-3"
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
              className="w-full rounded-lg border border-slate-300 px-4 py-3"
            />
          </div>
        )}

        {step === 2 && role === 'FREELANCER' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Ваш уровень</h2>
            <div className="grid grid-cols-3 gap-2">
              {['junior', 'middle', 'senior'].map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setExperienceLevel(level)}
                  className={`rounded-lg border px-3 py-3 text-sm font-medium ${
                    experienceLevel === level ? 'border-brand bg-indigo-50 text-brand' : 'border-slate-200'
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
            <h2 className="text-lg font-semibold">Ставка и доступность</h2>
            <input
              type="number"
              min="1"
              placeholder="Минимальная ставка, USD"
              value={expectedRateMin}
              onChange={(e) => setExpectedRateMin(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-3"
            />
            <select
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-3"
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
            className="rounded-lg border border-slate-300 px-4 py-3 font-medium disabled:opacity-40"
          >
            Назад
          </button>
          {step < lastStep ? (
            <button
              type="button"
              onClick={() => setStep((current) => Math.min(lastStep, current + 1))}
              className="rounded-lg bg-brand px-4 py-3 font-medium text-white"
            >
              Далее
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={loading}
              className="rounded-lg bg-brand px-4 py-3 font-medium text-white disabled:opacity-50"
            >
              {loading ? 'Сохраняем...' : 'В dashboard'}
            </button>
          )}
        </div>
      </section>
    </main>
  );
}
