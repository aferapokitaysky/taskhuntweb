/** Обучение — выпускная шапочка (mortarboard), для карточки категории. */
export function EducationIcon({ className = 'h-16 w-16' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" aria-hidden="true">
      <path d="M50 24 L90 42 L50 60 L10 42 Z" fill="#FDFCFA" stroke="#1A1A1A" strokeWidth="4" strokeLinejoin="round" />
      <path d="M30 50 v20 a20 8 0 0 0 40 0 v-20" stroke="#1A1A1A" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <path d="M86 42 v22" stroke="#1A1A1A" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="86" cy="68" r="4" fill="#CC785C" stroke="#1A1A1A" strokeWidth="2.5" />
    </svg>
  );
}
