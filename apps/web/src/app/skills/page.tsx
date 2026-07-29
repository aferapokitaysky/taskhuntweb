'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { Skill } from '@/lib/types';
import { AppHeader } from '@/components/AppHeader';
import { EmptyState } from '@/components/EmptyState';
import { EmptySearchIcon } from '@/components/icons/illustrated/EmptySearchIcon';
import { TagIcon } from '@/components/icons/TagIcon';

const SIZE_STEPS = [
  'text-sm px-3 py-1.5',
  'text-base px-3.5 py-1.5',
  'text-lg px-4 py-2 font-medium',
  'text-xl px-5 py-2.5 font-medium',
];

function sizeClassFor(usageCount: number, max: number): string {
  if (max === 0) return SIZE_STEPS[0];
  const ratio = usageCount / max;
  if (ratio > 0.75) return SIZE_STEPS[3];
  if (ratio > 0.45) return SIZE_STEPS[2];
  if (ratio > 0.15) return SIZE_STEPS[1];
  return SIZE_STEPS[0];
}

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Skill[]>('/skills')
      .then((list) => setSkills([...list].sort((a, b) => (b.usageCount ?? 0) - (a.usageCount ?? 0))))
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const maxUsage = Math.max(0, ...skills.map((s) => s.usageCount ?? 0));

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <AppHeader />
      <h1 className="mb-2 font-serif text-3xl text-stone-900">Навыки</h1>
      <p className="mb-8 text-stone-500">Чем чаще навык встречается у фрилансеров, тем крупнее его тэг. Кликните, чтобы посмотреть, кто им владеет.</p>

      {loading ? (
        <p className="text-stone-500">Загружаем навыки…</p>
      ) : skills.length === 0 ? (
        <EmptyState icon={<EmptySearchIcon />} title="Пока никто не указал навыки" description="Список заполнится, как только фрилансеры дополнят профили." />
      ) : (
        <div className="flex flex-wrap items-center gap-2.5 rounded-3xl bg-white p-8 shadow-sm">
          {skills.map((skill, index) => (
            <Link
              key={skill.id}
              href={`/freelancers?skillId=${skill.id}`}
              className={`inline-flex items-center gap-1.5 rounded-full border border-stone-200 text-stone-700 transition hover:border-brand hover:bg-brand/10 hover:text-brand ${sizeClassFor(skill.usageCount ?? 0, maxUsage)}`}
            >
              {index < 10 && <TagIcon className="h-3.5 w-3.5 shrink-0" />}
              {skill.name}
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
