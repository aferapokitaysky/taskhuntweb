/** Premium — корона, для карточки старшего тарифа. */
export function CrownIllustratedIcon({ className = 'h-12 w-12' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" aria-hidden="true">
      <path
        d="M14 40 L30 54 L50 22 L70 54 L86 40 L80 74 L20 74 Z"
        fill="#FDFCFA"
        stroke="#1A1A1A"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <circle cx="14" cy="36" r="6" fill="#FDFCFA" stroke="#1A1A1A" strokeWidth="3" />
      <circle cx="50" cy="18" r="6" fill="#FDFCFA" stroke="#1A1A1A" strokeWidth="3" />
      <circle cx="86" cy="36" r="6" fill="#FDFCFA" stroke="#1A1A1A" strokeWidth="3" />
      <path d="M28 80 L72 80" stroke="#1A1A1A" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
