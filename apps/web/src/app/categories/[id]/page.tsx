import type { Metadata } from 'next';
import CategoryDetailClient from './CategoryDetailClient';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface CategoryNode {
  id: string;
  name: string;
  children?: CategoryNode[];
}

async function fetchCategoryName(id: string): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/categories`, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const categories: CategoryNode[] = await res.json();
    const flat = categories.flatMap((c) => [c, ...(c.children ?? [])]);
    return flat.find((c) => c.id === id)?.name ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const name = await fetchCategoryName(params.id);
  if (!name) return { title: 'Категория' };

  return {
    title: name,
    description: `Заказы и фрилансеры в категории «${name}» на TaskHunt.`,
    alternates: { canonical: `/categories/${params.id}` },
  };
}

export default function CategoryDetailPage() {
  return <CategoryDetailClient />;
}
