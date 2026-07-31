/** Поддержка эскроу — щит с защищённой сделкой и маркером помощи. */
export function EscrowSupportShieldIcon({ className = 'h-12 w-12' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" aria-hidden="true">
      <path d="M50 10 84 24v20c0 22.5-12.5 38.2-34 47-21.5-8.8-34-24.5-34-47V24L50 10Z" fill="#E8DDC7" stroke="#1A1A1A" strokeWidth="4" strokeLinejoin="round" />
      <rect x="29" y="36" width="42" height="28" rx="8" fill="#FDFCFA" stroke="#1A1A1A" strokeWidth="3.5" />
      <path d="M38 50h24M38 57h16" stroke="#1A1A1A" strokeWidth="3.2" strokeLinecap="round" />
      <circle cx="69" cy="35" r="13" fill="#CC785C" stroke="#1A1A1A" strokeWidth="3.5" />
      <path d="M69 28v8" stroke="#FDFCFA" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="69" cy="41.5" r="2" fill="#FDFCFA" />
      <path d="M32 70c7 5 29 5 36 0" stroke="#8B9A72" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
