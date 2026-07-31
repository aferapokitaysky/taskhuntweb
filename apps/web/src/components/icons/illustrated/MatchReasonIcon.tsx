/** Причины совпадения — чек-лист с соединёнными точками для explainable matching. */
export function MatchReasonIcon({ className = 'h-16 w-16' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" aria-hidden="true">
      <rect x="18" y="14" width="64" height="72" rx="8" fill="#FDFCFA" stroke="#1A1A1A" strokeWidth="4" />
      <path d="M36 14 H64 V26 H36 V14Z" fill="#C7D3C9" stroke="#1A1A1A" strokeWidth="4" strokeLinejoin="round" />
      <path d="M32 42 L38 48 L50 36" stroke="#1A1A1A" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M56 42 H68" stroke="#1A1A1A" strokeWidth="3" strokeLinecap="round" />
      <path d="M32 62 L38 68 L50 56" stroke="#1A1A1A" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M56 62 H68" stroke="#1A1A1A" strokeWidth="3" strokeLinecap="round" />
      <circle cx="72" cy="30" r="12" fill="#CC785C" stroke="#1A1A1A" strokeWidth="4" />
      <path d="M72 24 V36 M66 30 H78" stroke="#FDFCFA" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}
