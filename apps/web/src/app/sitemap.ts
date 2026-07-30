import type { MetadataRoute } from 'next';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface FreelancerListItem {
  id: string;
  profile: { availableForWork?: boolean } | null;
}

interface OrderListItem {
  id: string;
}

async function fetchFreelancerIds(): Promise<string[]> {
  try {
    const res = await fetch(`${API_URL}/freelancers`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const freelancers: FreelancerListItem[] = await res.json();
    return freelancers.filter((f) => f.profile?.availableForWork !== false).map((f) => f.id);
  } catch {
    return [];
  }
}

async function fetchPublicOrderIds(): Promise<string[]> {
  try {
    const [openRes, completedRes] = await Promise.all([
      fetch(`${API_URL}/orders?status=OPEN`, { next: { revalidate: 3600 } }),
      fetch(`${API_URL}/orders?status=COMPLETED`, { next: { revalidate: 3600 } }),
    ]);
    const [open, completed]: [OrderListItem[], OrderListItem[]] = await Promise.all([
      openRes.ok ? openRes.json() : [],
      completedRes.ok ? completedRes.json() : [],
    ]);
    return [...open, ...completed].map((o) => o.id);
  } catch {
    return [];
  }
}

// Статика + динамика (/freelancers/[id], /orders/[id]) — публичные заказы
// только OPEN/COMPLETED (черновики, отменённые и спорные не индексируем,
// это приватная информация сторон сделки, не витрина).
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000';
  const now = new Date();

  const [freelancerIds, orderIds] = await Promise.all([fetchFreelancerIds(), fetchPublicOrderIds()]);

  return [
    { url: `${base}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/categories`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/skills`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${base}/pricing`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/register`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    ...freelancerIds.map((id) => ({
      url: `${base}/freelancers/${id}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.5,
    })),
    ...orderIds.map((id) => ({
      url: `${base}/orders/${id}`,
      lastModified: now,
      changeFrequency: 'daily' as const,
      priority: 0.4,
    })),
  ];
}
