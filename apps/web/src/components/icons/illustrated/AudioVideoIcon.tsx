/** Аудио и видео — клаппер (хлопушка), для карточки категории. */
export function AudioVideoIcon({ className = 'h-16 w-16' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" aria-hidden="true">
      <rect x="16" y="42" width="68" height="42" rx="6" fill="#FDFCFA" stroke="#1A1A1A" strokeWidth="4" strokeLinejoin="round" />
      <g transform="rotate(-10 20 42)">
        <rect x="16" y="24" width="68" height="16" rx="4" fill="#FDFCFA" stroke="#1A1A1A" strokeWidth="4" strokeLinejoin="round" />
        <path
          d="M28 24 L24 40 M44 24 L40 40 M60 24 L56 40 M76 24 L72 40"
          stroke="#1A1A1A"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>
      <path d="M38 56 L58 66 L38 76 Z" fill="#CC785C" stroke="#1A1A1A" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  );
}
