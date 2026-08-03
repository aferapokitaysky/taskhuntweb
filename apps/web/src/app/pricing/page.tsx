import type { Metadata } from 'next';
import PricingClient from './PricingClient';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';
const WEB_URL = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000';

interface SubscriptionTierData {
  name: 'STARTER' | 'PRO' | 'PREMIUM';
  priceUsd: string;
}

const TIER_TITLE: Record<SubscriptionTierData['name'], string> = {
  STARTER: 'Starter',
  PRO: 'Pro',
  PREMIUM: 'Premium',
};

async function fetchTiers(): Promise<SubscriptionTierData[]> {
  try {
    const res = await fetch(`${API_URL}/subscriptions/tiers`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export const metadata: Metadata = {
  title: 'Тарифы',
  description:
    'Тарифы TaskHunt для фрилансеров и заказчиков — Starter бесплатно, Pro и Premium со сниженной комиссией, бонусными бустами и увеличенными лимитами на отклики и заказы.',
  alternates: { canonical: '/pricing' },
};

export default async function PricingPage() {
  const tiers = await fetchTiers();

  const jsonLd =
    tiers.length > 0
      ? {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: 'TaskHunt — тарифы подписки',
          description: metadata.description,
          offers: tiers.map((tier) => ({
            '@type': 'Offer',
            name: TIER_TITLE[tier.name],
            price: tier.priceUsd,
            priceCurrency: 'USD',
            url: `${WEB_URL}/pricing`,
          })),
        }
      : null;

  return (
    <>
      {jsonLd && (
        // eslint-disable-next-line @next/next/no-danger
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      )}
      <PricingClient />
    </>
  );
}
