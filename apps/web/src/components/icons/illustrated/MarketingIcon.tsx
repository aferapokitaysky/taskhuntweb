/** Маркетинг — мегафон со звуковыми волнами, для карточки категории. */
export function MarketingIcon({ className = 'h-16 w-16' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" aria-hidden="true">
      <path
        d="M20 40 L52 22 a4 4 0 0 1 6 3.5 v49 a4 4 0 0 1 -6 3.5 L20 60 Z"
        fill="#FDFCFA"
        stroke="#1A1A1A"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <rect x="10" y="40" width="10" height="20" rx="3" fill="#CC785C" stroke="#1A1A1A" strokeWidth="3" />
      <path
        d="M20 60 L26 78 a4 4 0 0 0 4 3 h6 a4 4 0 0 0 3.8 -5.3 L30 60 Z"
        fill="#FDFCFA"
        stroke="#1A1A1A"
        strokeWidth="3"
        strokeLinejoin="round"
      />
      <path d="M66 32 a20 20 0 0 1 0 36" stroke="#1A1A1A" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M74 24 a32 32 0 0 1 0 52" stroke="#1A1A1A" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}
