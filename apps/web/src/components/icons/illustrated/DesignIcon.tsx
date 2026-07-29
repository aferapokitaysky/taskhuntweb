/** Дизайн — палитра с каплями цвета, для карточки категории. */
export function DesignIcon({ className = 'h-16 w-16' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" aria-hidden="true">
      <path
        d="M50 14 a36 36 0 1 0 14 69 c4 -1.8 3 -6 -0.5 -7.4 c-4 -1.6 -5.5 -6.6 -2 -9.6 c2 -1.7 4.7 -1.8 7 -1 a36 36 0 0 0 -18.5 -51 Z"
        fill="#FDFCFA"
        stroke="#1A1A1A"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <circle cx="34" cy="42" r="7" fill="#CC785C" stroke="#1A1A1A" strokeWidth="2.5" />
      <circle cx="52" cy="30" r="7" fill="#D7D5E8" stroke="#1A1A1A" strokeWidth="2.5" />
      <circle cx="68" cy="44" r="7" fill="#C7D3C9" stroke="#1A1A1A" strokeWidth="2.5" />
      <circle cx="38" cy="62" r="7" fill="#EDE1CE" stroke="#1A1A1A" strokeWidth="2.5" />
    </svg>
  );
}
