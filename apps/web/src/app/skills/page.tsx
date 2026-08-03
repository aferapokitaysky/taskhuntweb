import type { Metadata } from 'next';
import SkillsClient from './SkillsClient';

export const metadata: Metadata = {
  title: 'Навыки и технологии',
  description:
    'Все навыки и технологии на TaskHunt — от React и Python до дизайна и копирайтинга. Найдите фрилансера по конкретному стеку или навыку.',
  alternates: { canonical: '/skills' },
};

export default function SkillsPage() {
  return <SkillsClient />;
}
