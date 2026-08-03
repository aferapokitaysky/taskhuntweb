export function TransactionDirectionIcon({ direction, className = 'h-5 w-5' }: { direction: 'CREDIT' | 'DEBIT'; className?: string }) {
  const isCredit = direction === 'CREDIT';

  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
      <rect x="12" y="14" width="40" height="36" rx="14" fill={isCredit ? '#DDE9D8' : '#F0E5CF'} stroke="#1A1A1A" strokeWidth="4" />
      <path
        d={isCredit ? 'M32 43V22M22 32l10-10 10 10' : 'M32 21v21M22 32l10 10 10-10'}
        stroke="#1A1A1A"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="49" cy="18" r="8" fill={isCredit ? '#8B9A72' : '#CC785C'} stroke="#1A1A1A" strokeWidth="3" />
    </svg>
  );
}
