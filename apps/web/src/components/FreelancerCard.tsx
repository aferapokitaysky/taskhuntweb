import Link from 'next/link';
import { API_URL } from '@/lib/api';
import { TierBadge } from '@/components/TierBadge';
import { FreelancerLevelBadge, type FreelancerLevel } from '@/components/FreelancerLevelBadge';

export interface FreelancerListItem {
  id: string;
  level?: FreelancerLevel;
  profile: {
    displayName: string;
    avatarUrl?: string | null;
    bio?: string | null;
    country?: string | null;
    city?: string | null;
    successRate?: string | null;
    skills: { id: string; name: string }[];
  };
  subscriptionTier: 'STARTER' | 'PRO' | 'PREMIUM';
}

export function FreelancerCard({ freelancer }: { freelancer: FreelancerListItem }) {
  return (
    <Link
      href={`/freelancers/${freelancer.id}`}
      className="group rounded-2xl border border-stone-100 bg-white p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-md"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-card-sand font-serif text-lg text-stone-900">
          {freelancer.profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`${API_URL}${freelancer.profile.avatarUrl}`} alt="" className="h-full w-full object-cover" />
          ) : (
            freelancer.profile.displayName.charAt(0).toUpperCase()
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold text-stone-900">{freelancer.profile.displayName}</p>
            <TierBadge tier={freelancer.subscriptionTier} />
          </div>
          <p className="text-xs text-stone-500">
            {[freelancer.profile.city, freelancer.profile.country].filter(Boolean).join(', ') || 'Локация не указана'}
          </p>
          <FreelancerLevelBadge level={freelancer.level} className="mt-1.5" />
        </div>
      </div>
      {freelancer.profile.bio && <p className="mt-3 line-clamp-2 text-sm text-stone-600">{freelancer.profile.bio}</p>}
      <div className="mt-3 flex flex-wrap gap-1">
        {freelancer.profile.skills.slice(0, 4).map((skill) => (
          <span key={skill.id} className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">
            {skill.name}
          </span>
        ))}
      </div>
    </Link>
  );
}
