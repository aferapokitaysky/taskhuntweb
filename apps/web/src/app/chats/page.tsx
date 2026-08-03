import type { Metadata } from 'next';
import ChatsPageClient from './ChatsPageClient';

export const metadata: Metadata = {
  title: 'Чаты',
  robots: { index: false, follow: false },
};

export default function ChatsPage() {
  return <ChatsPageClient />;
}
