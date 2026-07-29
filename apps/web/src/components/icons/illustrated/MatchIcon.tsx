/** Подбор/совместимость — фигуры, соединённые линиями, в духе карточек-иллюстраций. */
export function MatchIcon({ className = 'h-16 w-16' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" aria-hidden="true">
      <polygon points="24,20 34,38 14,38" fill="#FDFCFA" stroke="#1A1A1A" strokeWidth="3" strokeLinejoin="round" />
      <circle cx="70" cy="30" r="16" fill="#FDFCFA" stroke="#1A1A1A" strokeWidth="3" />
      <rect x="56" y="56" width="28" height="28" rx="4" fill="#FDFCFA" stroke="#1A1A1A" strokeWidth="3" />
      <circle cx="32" cy="66" r="15" fill="#FDFCFA" stroke="#1A1A1A" strokeWidth="3" />
      <circle cx="24" cy="34" r="4" fill="#1A1A1A" />
      <circle cx="70" cy="38" r="4" fill="#1A1A1A" />
      <circle cx="70" cy="62" r="4" fill="#1A1A1A" />
      <circle cx="36" cy="66" r="4" fill="#1A1A1A" />
      <path d="M28 34 L66 38" stroke="#1A1A1A" strokeWidth="3" strokeLinecap="round" />
      <path d="M70 42 L70 62" stroke="#1A1A1A" strokeWidth="3" strokeLinecap="round" />
      <path d="M40 66 L66 62" stroke="#1A1A1A" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
