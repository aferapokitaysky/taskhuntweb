import type { Metadata } from 'next';
import './globals.css';
import { CookieConsent } from '@/components/CookieConsent';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000'),
  title: { default: 'TuskHunt — фриланс-биржа с крипто-эскроу', template: '%s — TuskHunt' },
  description: 'Фриланс-биржа со встроенным крипто-эскроу: деньги защищены на платформе, пока работа не сдана и не принята.',
  openGraph: {
    type: 'website',
    siteName: 'TuskHunt',
    title: 'TuskHunt — фриланс-биржа с крипто-эскроу',
    description: 'Деньги защищены эскроу-механизмом, пока работа не сдана и не принята.',
  },
  twitter: {
    card: 'summary',
    title: 'TuskHunt — фриланс-биржа с крипто-эскроу',
    description: 'Деньги защищены эскроу-механизмом, пока работа не сдана и не принята.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}
