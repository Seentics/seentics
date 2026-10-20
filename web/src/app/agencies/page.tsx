import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isEnterprise } from '@/lib/features';
import { AgenciesContent } from './AgenciesContent';

export const dynamic = 'force-static';

const TITLE = 'Seentics for agencies · Analytics for every client site';
const DESCRIPTION =
  'One workspace for all your client sites: analytics, replays and alerts across clients, white-label branding, embeddable dashboards and an agency API.';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/agencies' },
  openGraph: { title: TITLE, description: DESCRIPTION, url: '/agencies', siteName: 'Seentics', type: 'website' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

export default function AgenciesPage() {
  // Cloud only, like /pricing: a self-hosted install has no Agency plan to sell.
  if (!isEnterprise) notFound();
  return <AgenciesContent />;
}
