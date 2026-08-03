import type { Metadata } from 'next';
import VerifyEmailClient from './VerifyEmailClient';

// Тот же аргумент, что и в reset-password — URL несёт токен подтверждения.
export const metadata: Metadata = {
  title: 'Подтверждение почты',
  robots: { index: false, follow: false },
};

export default function VerifyEmailPage() {
  return <VerifyEmailClient />;
}
