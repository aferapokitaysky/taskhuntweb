import type { Metadata } from 'next';
import './globals.css';
import { CookieConsent } from '@/components/CookieConsent';
import { ToastProvider } from '@/components/Toast';

const TAGLINE =
  'Крипто-эскроу вместо доверия на слово: бюджет заказчика заморожен в системе с первого отклика — вывод в крипте, без банковских очередей и заморозки на карте.';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000'),
  title: { default: 'TaskHunt — фриланс-биржа с крипто-эскроу', template: '%s — TaskHunt' },
  description: TAGLINE,
  openGraph: {
    type: 'website',
    siteName: 'TaskHunt',
    title: 'TaskHunt — фриланс-биржа с крипто-эскроу',
    description: TAGLINE,
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'TaskHunt' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'TaskHunt — фриланс-биржа с крипто-эскроу',
    description: TAGLINE,
    images: ['/og-image.jpg'],
  },
};

const THEME_INIT_SCRIPT = `
  try {
    if (localStorage.getItem('theme') === 'dark') {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
        <ToastProvider>
          {children}
          <CookieConsent />
        </ToastProvider>
      </body>
    </html>
  );
}
