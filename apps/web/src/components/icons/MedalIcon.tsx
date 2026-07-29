export function MedalIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 3h8l-2.5 6h-3L8 3Z" />
      <circle cx="12" cy="15" r="6" />
      <path d="M12 12.3l1 2.1 2.3.3-1.65 1.6.4 2.3-2.05-1.1-2.05 1.1.4-2.3-1.65-1.6 2.3-.3 1-2.1Z" fill="currentColor" stroke="none" />
    </svg>
  );
}
