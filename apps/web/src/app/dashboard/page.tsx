import type { Metadata } from 'next';
import DashboardClient from './DashboardClient';

// Личный кабинет — уже в Disallow в robots.ts, но это не гарантирует
// НЕ-индексацию (Disallow останавливает обход, а не индексацию URL,
// найденного откуда-то ещё) — noindex здесь авторитетный сигнал для Google
// независимо от того, как конкретный краулер трактует правила robots.txt
// (см. конфликт групп User-agent: * от Cloudflare, обсуждали отдельно).
export const metadata: Metadata = {
  title: 'Личный кабинет',
  robots: { index: false, follow: false },
};

export default function DashboardPage() {
  return <DashboardClient />;
}
