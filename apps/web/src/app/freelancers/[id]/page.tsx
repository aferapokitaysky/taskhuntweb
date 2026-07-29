'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { TierBadge } from '@/components/TierBadge';
import { StarIcon } from '@/components/icons/StarIcon';
import { AppHeader } from '@/components/AppHeader';

interface PublicProfile {
  id: string;
  primaryRole: 'CLIENT' | 'FREELANCER';
  roles: ('CLIENT' | 'FREELANCER')[];
  profile: {
    displayName: string;
    avatarUrl?: string | null;
    bio?: string | null;
    country?: string | null;
    city?: string | null;
    githubUrl?: string | null;
    websiteUrl?: string | null;
    successRate?: string | null;
    completionRate?: string | null;
    avgResponseMins?: number | null;
    disputesCount: number;
    lateDeliveries: number;
    skills: { id: string; name: string }[];
  };
  subscriptionTier: 'STARTER' | 'PRO' | 'PREMIUM';
  reviews: { rating: number; comment?: string | null; createdAt: string; author: { displayName: string } }[];
}

export default function PublicProfilePage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<PublicProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<PublicProfile>(`/users/${params.id}`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Профиль не найден'))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) return <main className="mx-auto max-w-3xl px-4 py-10 text-stone-500">Загружаем профиль…</main>;

  if (error || !data) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-red-600">{error ?? 'Профиль не найден'}</p>
        <Link href="/freelancers" className="mt-4 inline-block text-brand hover:underline">
          ← Ко всем фрилансерам
        </Link>
      </main>
    );
  }

  const avgRating =
    data.reviews.length > 0 ? data.reviews.reduce((sum, r) => sum + r.rating, 0) / data.reviews.length : null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <AppHeader />
      <Link href="/freelancers" className="mb-6 inline-block text-sm font-medium text-stone-500 hover:text-stone-900">
        ← Ко всем фрилансерам
      </Link>

      <section className="rounded-3xl border border-stone-100 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-card-sand font-serif text-2xl text-stone-900">
              {data.profile.displayName.charAt(0).toUpperCase()}
            </div>
            <div>
            <div className="flex items-center gap-2">
              <h1 className="font-serif text-2xl text-stone-900">{data.profile.displayName}</h1>
              <TierBadge tier={data.subscriptionTier} />
            </div>
            <p className="mt-1 text-sm text-stone-500">
              {[data.profile.city, data.profile.country].filter(Boolean).join(', ') || 'Локация не указана'}
            </p>
            </div>
          </div>
          {avgRating !== null && (
            <div className="flex items-center gap-1 text-amber-500">
              <StarIcon className="h-5 w-5" filled />
              <span className="font-semibold text-stone-900">{avgRating.toFixed(1)}</span>
              <span className="text-sm text-stone-500">({data.reviews.length})</span>
            </div>
          )}
        </div>

        {data.profile.bio && <p className="mt-4 whitespace-pre-wrap text-stone-700">{data.profile.bio}</p>}

        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          {data.profile.githubUrl && (
            <a href={data.profile.githubUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline">
              GitHub
            </a>
          )}
          {data.profile.websiteUrl && (
            <a href={data.profile.websiteUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline">
              Сайт/портфолио
            </a>
          )}
        </div>

        {data.profile.skills.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {data.profile.skills.map((skill) => (
              <span key={skill.id} className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium text-stone-600">
                {skill.name}
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {(
          [
            ['Успешных сделок', data.profile.successRate ? `${data.profile.successRate}%` : '—', 'bg-card-sand'],
            ['Завершаемость', data.profile.completionRate ? `${data.profile.completionRate}%` : '—', 'bg-card-sage'],
            ['Ответ, мин', data.profile.avgResponseMins ?? '—', 'bg-card-rose'],
            ['Споров', data.profile.disputesCount, 'bg-card-lavender'],
          ] as const
        ).map(([label, value, colorClass]) => (
          <div key={label} className={`rounded-2xl ${colorClass} p-4 text-center`}>
            <p className="font-serif text-2xl text-stone-900">{value}</p>
            <p className="text-xs text-stone-700">{label}</p>
          </div>
        ))}
      </section>

      <section className="mt-6">
        <h2 className="mb-3 font-serif text-lg text-stone-900">Отзывы</h2>
        <div className="space-y-3">
          {data.reviews.map((review, i) => (
            <div key={i} className="rounded-2xl border border-stone-100 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="font-medium">{review.author.displayName}</p>
                <div className="flex items-center gap-1 text-amber-500">
                  <StarIcon className="h-4 w-4" filled />
                  <span className="text-sm">{review.rating}</span>
                </div>
              </div>
              {review.comment && <p className="mt-2 text-sm text-stone-600">{review.comment}</p>}
            </div>
          ))}
          {data.reviews.length === 0 && <p className="text-sm text-stone-500">Отзывов пока нет.</p>}
        </div>
      </section>
    </main>
  );
}
