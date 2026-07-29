/** Pro — ракета, для карточки среднего тарифа. */
export function RocketIcon({ className = 'h-12 w-12' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" aria-hidden="true">
      <path
        d="M50 10 C64 22 68 42 64 60 L36 60 C32 42 36 22 50 10 Z"
        fill="#FDFCFA"
        stroke="#1A1A1A"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <circle cx="50" cy="38" r="8" fill="#FDFCFA" stroke="#1A1A1A" strokeWidth="3" />
      <path d="M36 52 L20 68 L34 64 Z" fill="#FDFCFA" stroke="#1A1A1A" strokeWidth="3" strokeLinejoin="round" />
      <path d="M64 52 L80 68 L66 64 Z" fill="#FDFCFA" stroke="#1A1A1A" strokeWidth="3" strokeLinejoin="round" />
      <path d="M42 60 L40 82 L50 72 L60 82 L58 60" stroke="#1A1A1A" strokeWidth="3" strokeLinejoin="round" fill="#FDFCFA" />
    </svg>
  );
}
