import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000';
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/pricing', '/terms', '/privacy', '/freelancers', '/orders'],
        // Личные кабинеты и служебные разделы — не индексируем
        disallow: ['/dashboard', '/admin', '/profile', '/support', '/onboarding', '/oauth'],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
