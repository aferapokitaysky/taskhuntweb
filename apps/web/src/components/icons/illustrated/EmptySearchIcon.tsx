/** Пусто — лупа над пунктирным силуэтом карточки, для пустых состояний списков. */
export function EmptySearchIcon({ className = 'h-16 w-16' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" aria-hidden="true">
      <rect
        x="18"
        y="22"
        width="46"
        height="34"
        rx="6"
        stroke="#1A1A1A"
        strokeWidth="3"
        strokeDasharray="5 6"
        strokeLinecap="round"
      />
      <circle cx="66" cy="62" r="18" fill="#FDFCFA" stroke="#1A1A1A" strokeWidth="4" />
      <path d="M79 75 L90 86" stroke="#1A1A1A" strokeWidth="5" strokeLinecap="round" />
      <path d="M58 62 L74 62" stroke="#1A1A1A" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}
