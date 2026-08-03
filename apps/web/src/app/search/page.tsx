import type { Metadata } from 'next';
import SearchClient from './SearchClient';

// Результаты поиска — динамические, бесконечные комбинации запросов, тонкий
// контент под конкретный ?q= — не индексируем, но ссылки на заказы/профили
// внутри выдачи всё равно доступны для перехода (follow).
export const metadata: Metadata = {
  title: 'Поиск',
  robots: { index: false, follow: true },
};

export default function SearchPage() {
  return <SearchClient />;
}
