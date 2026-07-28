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
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs font-medium uppercase tracking-wide text-slate-400">или через</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      <a
        href={disabled ? undefined : `${API_URL}/auth/google${suffix}`}
        aria-disabled={disabled}
        className={`flex items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-3
          font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50
          ${disabled ? 'pointer-events-none opacity-40' : ''}`}
      >
        <GoogleIcon />
        Google
      </a>

      <a
        href={disabled ? undefined : `${API_URL}/auth/github${suffix}`}
        aria-disabled={disabled}
        className={`flex items-center justify-center gap-3 rounded-lg border border-slate-900 bg-slate-900 px-4 py-3
          font-medium text-white transition hover:bg-slate-800
          ${disabled ? 'pointer-events-none opacity-40' : ''}`}
      >
        <GithubIcon className="h-5 w-5 text-white" />
        GitHub
      </a>

      {disabled && <p className="text-center text-xs text-slate-400">Сначала выберите роль выше</p>}
    </div>
  );
}
