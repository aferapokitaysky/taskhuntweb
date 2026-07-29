import type { Metadata } from 'next';
import FreelancerProfileClient from './FreelancerProfileClient';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

interface FreelancerSeoData {
  profile: {
    displayName: string;
    bio?: string | null;
    avatarUrl?: string | null;
  } | null;
}

async function fetchFreelancer(id: string): Promise<FreelancerSeoData | null> {
  try {
    const res = await fetch(`${API_URL}/users/${id}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const data = await fetchFreelancer(params.id);
  if (!data?.profile) return { title: 'Профиль фрилансера' };

  return {
    title: data.profile.displayName,
    description: data.profile.bio?.slice(0, 160) ?? `Профиль фрилансера ${data.profile.displayName} на TaskHunt`,
  };
}

export default async function FreelancerProfilePage({ params }: { params: { id: string } }) {
  const data = await fetchFreelancer(params.id);

  const jsonLd = data?.profile
    ? {
        '@context': 'https://schema.org',
        '@type': 'ProfilePage',
        mainEntity: {
          '@type': 'Person',
          name: data.profile.displayName,
          description: data.profile.bio ?? undefined,
          image: data.profile.avatarUrl ? `${API_URL}${data.profile.avatarUrl}` : undefined,
        },
      }
    : null;

  return (
    <>
      {jsonLd && (
        // eslint-disable-next-line @next/next/no-danger
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      )}
      <FreelancerProfileClient />
    </>
  );
}
