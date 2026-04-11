'use client';

import { useParams } from 'next/navigation';
import { RealtimeDashboardSection } from '@/components/analytics/RealtimeDashboardSection';

export default function RealtimePage() {
  const params = useParams();
  const websiteId = params?.websiteId as string;

  if (!websiteId) return null;

  return <RealtimeDashboardSection websiteId={websiteId} />;
}
