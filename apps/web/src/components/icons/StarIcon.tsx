export function StarIcon({ className = 'h-6 w-6', filled = false }: { className?: string; filled?: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.5}
      aria-hidden="true"
    >
      <path
        strokeLinejoin="round"
        d="M12 2.5l2.955 6.13 6.545.96-4.75 4.735 1.122 6.675L12 17.77l-5.872 3.23 1.122-6.675L2.5 9.59l6.545-.96L12 2.5z"
      />
    </svg>
  );
}
