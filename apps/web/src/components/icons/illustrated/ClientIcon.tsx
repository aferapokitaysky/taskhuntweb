/** Заказчик — доска с карточками задач и флажок нового заказа, для выбора роли при регистрации. */
export function ClientIcon({ className = 'h-16 w-16' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" aria-hidden="true">
      <rect x="14" y="20" width="72" height="62" rx="6" fill="#FDFCFA" stroke="#1A1A1A" strokeWidth="4" strokeLinejoin="round" />
      <g stroke="#1A1A1A" strokeWidth="3.5" strokeLinejoin="round">
        <rect x="22" y="46" width="18" height="28" fill="#FDFCFA" />
        <rect x="44" y="38" width="18" height="36" fill="#FDFCFA" />
      </g>
      <path d="M22 54 L38 54 M22 62 L34 62" stroke="#1A1A1A" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M44 48 L60 48 M44 56 L56 56 M44 64 L58 64" stroke="#1A1A1A" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="76" cy="30" r="17" fill="#CC785C" stroke="#1A1A1A" strokeWidth="4" />
      <path d="M76 22 L76 38 M68 30 L84 30" stroke="#FDFCFA" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
