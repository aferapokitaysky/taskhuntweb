export function PricingNavIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
      <path d="M14 22h36a6 6 0 0 1 6 6v20a6 6 0 0 1-6 6H14a6 6 0 0 1-6-6V28a6 6 0 0 1 6-6z" fill="#FDFCFA" stroke="#1A1A1A" strokeWidth="3.2" />
      <path d="M18 22l6-11h28l-6 11" fill="#F0E5CF" />
      <path d="M18 22l6-11h28l-6 11" stroke="#1A1A1A" strokeWidth="3.2" strokeLinejoin="round" />
      <circle cx="44" cy="38" r="7" fill="#CC785C" stroke="#1A1A1A" strokeWidth="3" />
      <path d="M16 34h14" stroke="#1A1A1A" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
