export function BoostIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 14l6 6M12 3c3.5 3.5 5.5 8.5 5.5 12.5L14 19l-3.5-3.5L7 19l3.5-3.5C6.5 12 6.5 9 12 3z" />
    </svg>
  );
}
