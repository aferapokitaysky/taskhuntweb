/** Тексты и переводы — лист с текстом и пером, для карточки категории. */
export function TextIcon({ className = 'h-16 w-16' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" aria-hidden="true">
      <path
        d="M24 12 h38 l14 14 v58 a4 4 0 0 1 -4 4 H24 a4 4 0 0 1 -4 -4 V16 a4 4 0 0 1 4 -4 Z"
        fill="#FDFCFA"
        stroke="#1A1A1A"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path d="M62 12 V26 h14" stroke="#1A1A1A" strokeWidth="4" strokeLinejoin="round" />
      <path d="M32 46 h36 M32 58 h36 M32 70 h22" stroke="#1A1A1A" strokeWidth="3.5" strokeLinecap="round" />
      <path
        d="M78 62 L88 72 L70 90 L60 90 L60 80 Z"
        fill="#CC785C"
        stroke="#1A1A1A"
        strokeWidth="3"
        strokeLinejoin="round"
      />
    </svg>
  );
}
