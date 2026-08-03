import { GoogleIcon } from './icons/GoogleIcon';
import { GithubIcon } from './icons/GithubIcon';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface OAuthButtonsProps {
  /** На регистрации роль обязана быть выбрана заранее — без неё OAuth-ссылки задизейблены. */
  role?: 'CLIENT' | 'FREELANCER' | null;
}

export function OAuthButtons({ role }: OAuthButtonsProps) {
  const roleRequired = role !== undefined;
  const disabled = roleRequired && !role;
  const suffix = role ? `?role=${role}` : '';

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-stone-200" />
        <span className="text-[11px] font-medium uppercase tracking-wide text-stone-400 sm:text-xs">или через</span>
        <div className="h-px flex-1 bg-stone-200" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <a
          href={disabled ? undefined : `${API_URL}/auth/google${suffix}`}
          aria-disabled={disabled}
          className={`secondary-action flex items-center justify-center gap-2 px-3 py-2 text-sm sm:gap-3 sm:px-4 sm:py-2.5
            ${disabled ? 'pointer-events-none opacity-40' : ''}`}
        >
          <GoogleIcon />
          Google
        </a>

        <a
          href={disabled ? undefined : `${API_URL}/auth/github${suffix}`}
          aria-disabled={disabled}
          className={`flex items-center justify-center gap-2 rounded-2xl border border-stone-900 bg-stone-900 px-3 py-2
            text-sm font-semibold text-white shadow-lg shadow-stone-900/10 transition hover:-translate-y-0.5 hover:bg-stone-800 sm:gap-3 sm:px-4 sm:py-2.5
            ${disabled ? 'pointer-events-none opacity-40' : ''}`}
        >
          <GithubIcon className="h-5 w-5 text-white" />
          GitHub
        </a>
      </div>

      {disabled && <p className="text-center text-xs text-stone-400">Сначала выберите роль выше</p>}
    </div>
  );
}
