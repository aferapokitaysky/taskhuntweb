/** Защищённая сделка — щит с монетой, для карточки про эскроу. */
export function EscrowIcon({ className = 'h-16 w-16' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" aria-hidden="true">
      <path
        d="M50 12 L82 24 C82 52 70 74 50 88 C30 74 18 52 18 24 Z"
        fill="#FDFCFA"
        stroke="#1A1A1A"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <circle cx="50" cy="46" r="15" fill="none" stroke="#1A1A1A" strokeWidth="3.5" />
      <path d="M50 38 L50 54" stroke="#1A1A1A" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M44 42 Q50 36 56 42" stroke="#1A1A1A" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <path d="M44 50 Q50 56 56 50" stroke="#1A1A1A" strokeWidth="3.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}
