import type { Metadata } from 'next';
import ReferralsClient from './ReferralsClient';

export const metadata: Metadata = {
  title: 'Партнёрство и реклама',
  description: 'Сотрудничество, размещение рекламы и партнёрские интеграции с TaskHunt — пишите нам в Telegram.',
  alternates: { canonical: '/referrals' },
};

export default function ReferralsPage() {
  return <ReferralsClient />;
}
