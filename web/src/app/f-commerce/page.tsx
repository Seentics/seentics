import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isEnterprise } from '@/lib/features';
import FcommercePage from '@/components/landing/fcommerce/FcommercePage';

export const dynamic = 'force-static';

// In Bangla: the page is for Facebook sellers in Bangladesh, and it is what their search and share cards show.
const TITLE = 'Seentics · Facebook Ads থেকে আরও বেশি অর্ডার, পুরো Analytics সহ';
const DESCRIPTION =
  'Website ছাড়াই বাংলা Order Page, কোন Ad অর্ডার আনছে তার Analytics, Heatmap আর Session Recording, Fake Order চেক আর Server-side Facebook Conversion Tracking। bKash বা Nagad দিয়ে পেমেন্ট।';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/f-commerce' },
  openGraph: { title: TITLE, description: DESCRIPTION, url: '/f-commerce', siteName: 'Seentics', type: 'website', locale: 'bn_BD' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

export default function Page() {
  // Cloud only, like /agencies: the shop lives on seentics.shop, which a self-hosted install does not have.
  if (!isEnterprise) notFound();
  return <FcommercePage />;
}
