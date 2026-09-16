import type { Metadata } from 'next';
import { PageSpeedTester } from '@/components/tools/PageSpeedTester';

export const metadata: Metadata = {
  title: 'Free Website Speed Test — Seentics',
  description:
    'Test any website\'s performance for free. Get Core Web Vitals, a Lighthouse-based score, and the top fixes to make your site faster.',
};

export default function PageSpeedTestPage() {
  return <PageSpeedTester />;
}
