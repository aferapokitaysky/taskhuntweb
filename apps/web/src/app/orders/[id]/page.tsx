import type { Metadata } from 'next';
import OrderDetailClient from './OrderDetailClient';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface OrderSeoData {
  title: string;
  description: string;
  budgetMin: string;
  budgetMax?: string | null;
  currency: string;
  createdAt: string;
}

async function fetchOrder(id: string): Promise<OrderSeoData | null> {
  try {
    const res = await fetch(`${API_URL}/orders/${id}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const order = await fetchOrder(params.id);
  if (!order) return { title: 'Заказ' };

  return {
    title: order.title,
    description: order.description.slice(0, 160),
  };
}

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const order = await fetchOrder(params.id);

  const jsonLd = order
    ? {
        '@context': 'https://schema.org',
        '@type': 'JobPosting',
        title: order.title,
        description: order.description,
        datePosted: order.createdAt,
        hiringOrganization: { '@type': 'Organization', name: 'TaskHunt' },
        baseSalary: {
          '@type': 'MonetaryAmount',
          currency: order.currency,
          value: {
            '@type': 'QuantitativeValue',
            minValue: Number(order.budgetMin),
            maxValue: order.budgetMax ? Number(order.budgetMax) : Number(order.budgetMin),
          },
        },
      }
    : null;

  return (
    <>
      {jsonLd && (
        // eslint-disable-next-line @next/next/no-danger
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      )}
      <OrderDetailClient />
    </>
  );
}
