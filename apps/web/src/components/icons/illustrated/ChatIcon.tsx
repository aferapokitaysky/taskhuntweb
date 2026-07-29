/** Общение — облако с волнистыми линиями, для карточки про чат с фрилансером. */
export function ChatIcon({ className = 'h-16 w-16' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" aria-hidden="true">
      <path
        d="M20 26 h60 a6 6 0 0 1 6 6 v34 a6 6 0 0 1 -6 6 h-38 l-14 14 v-14 h-8 a6 6 0 0 1 -6 -6 v-34 a6 6 0 0 1 6 -6 Z"
        fill="#FDFCFA"
        stroke="#1A1A1A"
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <path d="M32 44 Q40 38 48 44 T64 44" stroke="#1A1A1A" strokeWidth="3.5" strokeLinecap="round" fill="none" />
      <path d="M32 58 Q38 54 44 58" stroke="#1A1A1A" strokeWidth="3.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}
