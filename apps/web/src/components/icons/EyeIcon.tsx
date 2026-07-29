export function EyeIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12c2.2-4.2 5.8-6.5 10-6.5s7.8 2.3 10 6.5c-2.2 4.2-5.8 6.5-10 6.5S4.2 16.2 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
