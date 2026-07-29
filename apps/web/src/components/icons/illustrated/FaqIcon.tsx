/** FAQ — сплошная плашечная пиктограмма (в духе фирменных pictogram-иконок), а не просто контур. */
export function FaqIcon({ className = 'h-10 w-10' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" aria-hidden="true">
      <path
        d="M50 8 C25.7 8 6 25.9 6 48 C6 59.3 11.2 69.5 19.7 76.8 C19.2 82.6 17.1 88.9 13 93.5 C12.1 94.5 12.9 96.1 14.3 95.9 C23.4 94.6 31.3 90.8 36.8 86.6 C40.9 87.6 45.3 88 50 88 C74.3 88 94 70.1 94 48 C94 25.9 74.3 8 50 8 Z"
        fill="#CC785C"
      />
      <path
        d="M39 40 C39 29 61 29 61 41 C61 49.5 50 49.5 50 59"
        stroke="#FDFCFA"
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="50" cy="73" r="4.5" fill="#FDFCFA" />
    </svg>
  );
}
