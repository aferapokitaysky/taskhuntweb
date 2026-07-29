/** Разместить заказ — рука кладёт кирпич в кладку, в духе карточек-иллюстраций. */
export function BuildIcon({ className = 'h-16 w-16' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" aria-hidden="true">
      <g stroke="#1A1A1A" strokeWidth="3.5" strokeLinejoin="round">
        <rect x="14" y="70" width="24" height="16" fill="#FDFCFA" />
        <rect x="38" y="70" width="24" height="16" fill="#FDFCFA" />
        <rect x="62" y="70" width="24" height="16" fill="#FDFCFA" />
        <rect x="26" y="54" width="24" height="16" fill="#FDFCFA" />
        <rect x="50" y="54" width="24" height="16" fill="#FDFCFA" />
      </g>
      <path
        d="M30 16 C24 16 20 20 22 26 C18 27 16 32 20 36 C18 41 22 46 28 45 L44 40 L38 22 Z"
        fill="#FDFCFA"
        stroke="#1A1A1A"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <rect x="40" y="24" width="18" height="12" rx="2" fill="#1A1A1A" transform="rotate(-18 40 24)" />
    </svg>
  );
}
