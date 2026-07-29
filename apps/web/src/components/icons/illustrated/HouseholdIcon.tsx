/** Бытовые услуги — дом с сердцем на двери, для карточки категории. */
export function HouseholdIcon({ className = 'h-16 w-16' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" aria-hidden="true">
      <path
        d="M50 14 L86 42 V82 a4 4 0 0 1 -4 4 H18 a4 4 0 0 1 -4 -4 V42 Z"
        fill="#FDFCFA"
        stroke="#1A1A1A"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path d="M10 48 L50 16 L90 48" stroke="#1A1A1A" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M50 74 C50 74 38 66 38 58 a7 7 0 0 1 12 -5 a7 7 0 0 1 12 5 c0 8 -12 16 -12 16 Z"
        fill="#CC785C"
        stroke="#1A1A1A"
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </svg>
  );
}
