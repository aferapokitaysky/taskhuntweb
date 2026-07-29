/** Восстановление доступа — карточка с замочной скважиной, которую держат две руки, для страниц входа/сброса пароля. */
export function AccessIcon({ className = 'h-16 w-16' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" aria-hidden="true">
      <rect x="28" y="28" width="44" height="44" rx="5" fill="#FDFCFA" stroke="#1A1A1A" strokeWidth="4" strokeLinejoin="round" />
      <circle cx="50" cy="44" r="7" fill="#1A1A1A" />
      <path d="M45 50 L55 50 L52 62 L48 62 Z" fill="#1A1A1A" />

      <g stroke="#1A1A1A" strokeWidth="5" strokeLinecap="round" fill="none">
        <path d="M4 38 C10 32 10 44 17 44 C24 44 21 33 28 37" />
        <path d="M8 54 C15 59 21 56 28 58" />
      </g>

      <g stroke="#1A1A1A" strokeWidth="5" strokeLinecap="round" fill="none">
        <path d="M96 38 C90 32 90 44 83 44 C76 44 79 33 72 37" />
        <path d="M92 54 C85 59 79 56 72 58" />
      </g>
    </svg>
  );
}
