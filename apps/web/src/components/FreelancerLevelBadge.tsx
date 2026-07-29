import { MedalIcon } from '@/components/icons/MedalIcon';

export type FreelancerLevel = 'TOP_RATED' | 'RISING_TALENT' | 'NEW';

const LABELS: Record<Exclude<FreelancerLevel, 'NEW'>, string> = {
  TOP_RATED: 'Лучший исполнитель',
  RISING_TALENT: 'Восходящая звезда',
};

const COLORS: Record<Exclude<FreelancerLevel, 'NEW'>, string> = {
  TOP_RATED: 'bg-amber-100 text-amber-700',
  RISING_TALENT: 'bg-emerald-100 text-emerald-700',
};

/** Бейдж уровня фрилансера — ничего не рендерит для 'NEW' (большинство
 * новых фрилансеров, не хотим создавать шум пустым/нейтральным бейджем). */
export function FreelancerLevelBadge({ level, className = '' }: { level?: FreelancerLevel; className?: string }) {
  if (!level || level === 'NEW') return null;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${COLORS[level]} ${className}`}
    >
      <MedalIcon className="h-3.5 w-3.5" />
      {LABELS[level]}
    </span>
  );
}
