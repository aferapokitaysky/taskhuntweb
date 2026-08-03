import type { MetadataRoute } from 'next';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface FreelancerListItem {
  id: string;
  profile: { availableForWork?: boolean } | null;
}

interface OrderListItem {
  id: string;
}

interface PaginatedOrdersResponse {
  items: OrderListItem[];
}

interface CategoryNode {
  id: string;
  children?: CategoryNode[];
}

async function fetchCategoryIds(): Promise<string[]> {
  try {
    const res = await fetch(`${API_URL}/categories`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const categories: CategoryNode[] = await res.json();
    return categories.flatMap((c) => [c.id, ...(c.children ?? []).map((child) => child.id)]);
  } catch {
    return [];
  }
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

// limit=300 — потолок пула ранжирования на бэкенде (OrdersService.FEED_CANDIDATE_POOL_SIZE),
// запрашивать больше нет смысла, всё равно не наберётся.
async function fetchPublicOrderIds(): Promise<string[]> {
  try {
    const [openRes, completedRes] = await Promise.all([
      fetch(`${API_URL}/orders?status=OPEN&limit=300`, { next: { revalidate: 3600 } }),
      fetch(`${API_URL}/orders?status=COMPLETED&limit=300`, { next: { revalidate: 3600 } }),
    ]);
    const [open, completed]: [PaginatedOrdersResponse, PaginatedOrdersResponse] = await Promise.all([
      openRes.ok ? openRes.json() : { items: [] },
      completedRes.ok ? completedRes.json() : { items: [] },
    ]);
    return [...open.items, ...completed.items].map((o) => o.id);
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

  const [categoryIds, freelancerIds, orderIds] = await Promise.all([
    fetchCategoryIds(),
    fetchFreelancerIds(),
    fetchPublicOrderIds(),
  ]);

  return [
    { url: `${base}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/categories`, lastModified: now, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/freelancers`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    { url: `${base}/skills`, lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${base}/pricing`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/register`, lastModified: now, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/referrals`, lastModified: now, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${base}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    ...categoryIds.map((id) => ({
      url: `${base}/categories/${id}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
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
