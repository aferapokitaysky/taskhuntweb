import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000';
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/pricing', '/terms', '/privacy', '/freelancers', '/orders', '/categories', '/skills', '/register', '/referrals'],
        // Личные кабинеты, служебные разделы и auth-флоу — не индексируем.
        // Дублируется с <meta name="robots" content="noindex"> на самих
        // страницах намеренно: Disallow тут останавливает ОБХОД, но не
        // гарантирует НЕ-индексацию URL, найденного откуда-то ещё — noindex
        // на странице авторитетнее. См. также конфликт групп User-agent: *,
        // который Cloudflare добавляет перед этим блоком в реальный robots.txt.
        disallow: [
          '/dashboard',
          '/admin',
          '/profile',
          '/support',
          '/onboarding',
          '/oauth',
          '/login',
          '/forgot-password',
          '/reset-password',
          '/verify-email',
          '/search',
          '/chats',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
