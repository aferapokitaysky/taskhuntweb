/** Защищённый найм — щит с рукопожатием для карточки эскроу. */
export function TalentShieldIcon({ className = 'h-12 w-12' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" aria-hidden="true">
      <path d="M50 9 83 23v20c0 22-12.3 38.3-33 48-20.7-9.7-33-26-33-48V23L50 9Z" fill="#D7D5E8" stroke="#1A1A1A" strokeWidth="4" strokeLinejoin="round" />
      <path d="M30 48c5-7 12-7 18 0l3 3 3-3c6-7 13-7 18 0" stroke="#1A1A1A" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M38 56l10 10c3 3 7 3 10 0l8-8" stroke="#1A1A1A" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M42 45l-8-8M58 45l8-8" stroke="#CC785C" strokeWidth="4" strokeLinecap="round" />
      <circle cx="50" cy="31" r="7" fill="#FDFCFA" stroke="#1A1A1A" strokeWidth="3.5" />
      <path d="M36 74c8 4 20 4 28 0" stroke="#8B9A72" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
