import type { Metadata } from 'next';
import OnboardingClient from './OnboardingClient';

export const metadata: Metadata = {
  title: 'Настройка профиля',
  robots: { index: false, follow: false },
};

export default function OnboardingPage() {
  return <OnboardingClient />;
}
