import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { isEnterprise } from '@/lib/features';
import BdPage from '@/components/landing/bd/BdPage';

export const dynamic = 'force-static';

// In Bangla: the page is for Bangladeshi stores with their own website, and it is what their search and share cards show.
const TITLE = 'Seentics · Facebook Ads-এর প্রতিটা Sale Track করুন, Ad খরচ কমান';
const DESCRIPTION =
  'Server-side Tracking আপনার Website-এর প্রতিটা অর্ডার সঠিকভাবে Facebook-এ পাঠায়, Pixel মিস করলেও। সাথে পুরো Analytics, Heatmap আর Session Recording। WooCommerce, Shopify আর যেকোনো Website-এ কাজ করে।';

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/bd', languages: { 'bn-BD': '/bd', en: '/' } },
  openGraph: { title: TITLE, description: DESCRIPTION, url: '/bd', siteName: 'Seentics', type: 'website', locale: 'bn_BD' },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
};

export default function Page() {
  // Cloud only, like /f-commerce: taka plans and invoices exist only on the hosted product.
  if (!isEnterprise) notFound();
  return <BdPage />;
}
