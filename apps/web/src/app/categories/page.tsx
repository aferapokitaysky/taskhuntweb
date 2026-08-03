import type { Metadata } from 'next';
import CategoriesClient from './CategoriesClient';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface CategoryListItem {
  id: string;
  name: string;
  slug: string;
}

async function fetchCategories(): Promise<CategoryListItem[]> {
  try {
    const res = await fetch(`${API_URL}/categories`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export const metadata: Metadata = {
  title: 'Категории услуг',
  description:
    'Все категории фриланс-услуг на TaskHunt — веб-разработка, дизайн, маркетинг, тексты и переводы, аудио и видео, бизнес и консалтинг, обучение. Найдите исполнителя или закажите задачу по своей нише.',
  alternates: { canonical: '/categories' },
};

export default async function CategoriesPage() {
  const categories = await fetchCategories();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    itemListElement: categories.map((category, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: category.name,
      url: `${process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000'}/categories/${category.id}`,
    })),
  };

  return (
    <>
      {categories.length > 0 && (
        // eslint-disable-next-line @next/next/no-danger
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      )}
      <CategoriesClient />
    </>
  );
}
