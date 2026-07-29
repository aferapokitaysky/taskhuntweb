/** Предупреждение — треугольник с восклицательным знаком, для сообщений об ошибках. */
export function AlertIcon({ className = 'h-6 w-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} fill="none" aria-hidden="true">
      <path d="M50 10 L94 84 H6 Z" fill="#FCEBEA" stroke="#B42318" strokeWidth="5" strokeLinejoin="round" />
      <path d="M50 38 L50 62" stroke="#B42318" strokeWidth="6" strokeLinecap="round" />
      <circle cx="50" cy="74" r="4.5" fill="#B42318" />
    </svg>
  );
}
