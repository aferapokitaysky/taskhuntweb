export function TalentNavIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} fill="none" aria-hidden="true">
      <circle cx="24" cy="24" r="10" fill="#FDFCFA" stroke="#1A1A1A" strokeWidth="3.2" />
      <path d="M10 54c2.2-11 9-17 18-17s15.8 6 18 17" fill="#C8D3C6" />
      <path d="M10 54c2.2-11 9-17 18-17s15.8 6 18 17" stroke="#1A1A1A" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M45 13l2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" fill="#CC785C" stroke="#1A1A1A" strokeWidth="2.6" strokeLinejoin="round" />
    </svg>
  );
}
