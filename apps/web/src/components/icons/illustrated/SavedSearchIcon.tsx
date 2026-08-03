/** Сохранённый поиск — карточка результата с лупой и закладкой, в стиле рисованных иллюстраций проекта. */
export function SavedSearchIcon({ className = 'h-16 w-16' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" aria-hidden="true">
      <rect x="14" y="18" width="62" height="58" rx="8" fill="#FDFCFA" stroke="#1A1A1A" strokeWidth="4" />
      <path d="M28 34 H58 M28 46 H50 M28 58 H44" stroke="#1A1A1A" strokeWidth="3" strokeLinecap="round" />
      <path d="M62 18 H76 V48 L69 43 L62 48 V18Z" fill="#E3A98C" stroke="#1A1A1A" strokeWidth="4" strokeLinejoin="round" />
      <circle cx="66" cy="67" r="13" fill="#FDFCFA" stroke="#1A1A1A" strokeWidth="4" />
      <path d="M76 77 L86 87" stroke="#1A1A1A" strokeWidth="5" strokeLinecap="round" />
      <circle cx="66" cy="67" r="4" fill="#CC785C" />
    </svg>
  );
}
