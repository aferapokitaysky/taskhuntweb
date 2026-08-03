/** Баланс в обработке — часы и монета для pending-операций. */
export function BalancePendingIcon({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" aria-hidden="true">
      <circle cx="50" cy="50" r="34" fill="#F7EFDD" stroke="#1A1A1A" strokeWidth="4" />
      <path d="M50 28v23l15 9" stroke="#1A1A1A" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="73" cy="27" r="12" fill="#D7D5E8" stroke="#1A1A1A" strokeWidth="3.5" />
      <path d="M68 27h10" stroke="#CC785C" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M28 80h44" stroke="#1A1A1A" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
