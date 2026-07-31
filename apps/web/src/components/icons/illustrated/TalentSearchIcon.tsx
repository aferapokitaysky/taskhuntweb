/** Поиск исполнителя — фирменная лупа с карточкой профиля для блока подбора. */
export function TalentSearchIcon({ className = 'h-12 w-12' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" aria-hidden="true">
      <rect x="16" y="18" width="46" height="56" rx="12" fill="#FDFCFA" stroke="#1A1A1A" strokeWidth="4" />
      <circle cx="39" cy="38" r="9" fill="#C8D5C7" stroke="#1A1A1A" strokeWidth="3.5" />
      <path d="M27 59c3.5-8 20.5-8 24 0" stroke="#1A1A1A" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M26 68h22" stroke="#CC785C" strokeWidth="4" strokeLinecap="round" />
      <circle cx="64" cy="58" r="18" fill="#E8DDC7" stroke="#1A1A1A" strokeWidth="4" />
      <path d="m77 71 12 12" stroke="#1A1A1A" strokeWidth="6" strokeLinecap="round" />
      <path d="M57 58h14M64 51v14" stroke="#1A1A1A" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}
