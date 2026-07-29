import type { MetadataRoute } from 'next';

// Динамические страницы (/freelancers/[id], /orders/[id]) добавятся сюда,
// когда появятся сами публичные страницы — сейчас только статика.
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000';
  const now = new Date();

  return [
    { url: `${base}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/categories`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/skills`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${base}/pricing`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/register`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
