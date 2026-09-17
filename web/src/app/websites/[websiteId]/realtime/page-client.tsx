'use client';

import { usePathSegment } from '@/lib/path-segment';


import { RealtimeDashboardSection } from '@/components/analytics/RealtimeDashboardSection';

export default function RealtimePage() {
  const params = { websiteId: usePathSegment(1) ?? '' };
  const websiteId = params?.websiteId as string;

  if (!websiteId) return null;

  return <RealtimeDashboardSection websiteId={websiteId} />;
}
