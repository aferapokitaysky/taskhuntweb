export function MoonIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 14.5A8.5 8.5 0 119.5 4a6.5 6.5 0 0010.5 10.5z" />
    </svg>
  );
}
