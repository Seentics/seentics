'use client';

import { usePathSegment } from '@/lib/path-segment';
import { WebsiteOverview } from '@/components/analytics/WebsiteOverview';

export default function WebsiteDashboardPage() {
  const websiteId = usePathSegment(1) ?? '';
  return <WebsiteOverview websiteId={websiteId} />;
}
