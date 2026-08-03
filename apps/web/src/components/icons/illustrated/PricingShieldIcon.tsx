/** Тарифная защита — щит с чек-листом и монетой для блока подписки. */
export function PricingShieldIcon({ className = 'h-12 w-12' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" aria-hidden="true">
      <path d="M50 8 82 21v23c0 20.5-11.8 36.8-32 47-20.2-10.2-32-26.5-32-47V21L50 8Z" fill="#C8D5C7" stroke="#1A1A1A" strokeWidth="4" strokeLinejoin="round" />
      <path d="M30 34h40v34a6 6 0 0 1-6 6H36a6 6 0 0 1-6-6V34Z" fill="#FDFCFA" stroke="#1A1A1A" strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M39 47h16M39 58h12" stroke="#1A1A1A" strokeWidth="3.5" strokeLinecap="round" />
      <path d="m60 56 5 5 10-12" stroke="#CC785C" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="67" cy="31" r="10" fill="#E8DDC7" stroke="#1A1A1A" strokeWidth="3.5" />
      <path d="M67 25v12M61 31h12" stroke="#1A1A1A" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
