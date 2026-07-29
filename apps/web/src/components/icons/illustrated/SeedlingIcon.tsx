/** Starter — росток, для карточки начального тарифа. */
export function SeedlingIcon({ className = 'h-12 w-12' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" aria-hidden="true">
      <path d="M50 88 L50 46" stroke="#1A1A1A" strokeWidth="4" strokeLinecap="round" />
      <path
        d="M50 50 C50 30 30 22 16 24 C16 42 30 52 50 50 Z"
        fill="#FDFCFA"
        stroke="#1A1A1A"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <path
        d="M50 40 C50 22 68 14 82 16 C82 32 70 42 50 40 Z"
        fill="#FDFCFA"
        stroke="#1A1A1A"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <ellipse cx="50" cy="90" rx="20" ry="5" fill="#1A1A1A" opacity="0.08" />
    </svg>
  );
}
