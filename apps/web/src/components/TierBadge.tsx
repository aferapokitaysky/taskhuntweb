import { CrownIcon } from './icons/CrownIcon';

export function TierBadge({ tier }: { tier: 'STARTER' | 'PRO' | 'PREMIUM' }) {
  if (tier === 'STARTER') return null;

  const styles =
    tier === 'PREMIUM'
      ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-white'
      : 'bg-indigo-100 text-brand';

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${styles}`}>
      <CrownIcon className="h-3 w-3" />
      {tier === 'PREMIUM' ? 'Premium' : 'Pro'}
    </span>
  );
}
