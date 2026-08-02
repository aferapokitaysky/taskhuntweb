/** Бизнес и консалтинг — портфель, для карточки категории. */
export function BusinessIcon({ className = 'h-16 w-16' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" aria-hidden="true">
      <path
        d="M38 26 h24 a6 6 0 0 1 6 6 v8 h-36 v-8 a6 6 0 0 1 6 -6 Z"
        fill="#FDFCFA"
        stroke="#1A1A1A"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <rect x="14" y="40" width="72" height="46" rx="8" fill="#FDFCFA" stroke="#1A1A1A" strokeWidth="4" strokeLinejoin="round" />
      <path d="M14 58 H86" stroke="#1A1A1A" strokeWidth="3.5" />
      <rect x="44" y="52" width="12" height="12" rx="2" fill="#CC785C" stroke="#1A1A1A" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  );
}
