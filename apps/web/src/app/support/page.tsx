import type { Metadata } from 'next';
import SupportClient from './SupportClient';

export const metadata: Metadata = {
  title: 'Поддержка',
  robots: { index: false, follow: false },
};

export default function SupportPage() {
  return <SupportClient />;
}
