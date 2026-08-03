import type { Metadata } from 'next';
import FreelancersClient from './FreelancersClient';

export const metadata: Metadata = {
  title: 'Каталог фрилансеров',
  description:
    'Каталог проверенных фрилансеров TaskHunt — разработчики, дизайнеры, маркетологи, копирайтеры и другие специалисты. Фильтр по категориям и навыкам, отзывы и портфолио, оплата через крипто-эскроу.',
  alternates: { canonical: '/freelancers' },
};

export default function FreelancersPage() {
  return <FreelancersClient />;
}
