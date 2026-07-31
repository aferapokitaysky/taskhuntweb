/** Деньги в эскроу — щит с защищённой монетой. */
export function BalanceEscrowIcon({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" aria-hidden="true">
      <path d="M50 11l32 12v22c0 21-12 35-32 44-20-9-32-23-32-44V23z" fill="#DDE9D8" stroke="#1A1A1A" strokeWidth="4" strokeLinejoin="round" />
      <circle cx="50" cy="48" r="16" fill="#FDFCFA" stroke="#1A1A1A" strokeWidth="4" />
      <path d="M50 38v20M43 43c5-5 9-5 14 0M43 54c5 5 9 5 14 0" stroke="#CC785C" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M68 20h10M73 15v10" stroke="#1A1A1A" strokeWidth="3.5" strokeLinecap="round" />
    </svg>
  );
}
