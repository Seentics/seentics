'use client';

import { usePathSegment } from '@/lib/path-segment';


import { PathAnalysis } from '@/components/analytics/PathAnalysis';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { Route, Clock, TrendingUp, Users } from 'lucide-react';
import { PathsDashboardView } from '@/components/paths/PathsDashboardView';

export default function PathsPage() {
  const params = { websiteId: usePathSegment(1) ?? '' };
  const websiteId = params?.websiteId as string;

  return (
    <PathsDashboardView
      websiteId={websiteId}
      header={
        <DashboardPageHeader
          websiteId={websiteId}
          title="User Paths"
          description="Discover the most common journeys users take through your product."
        />
      }
      stats={[
          { label: 'Avg Path Length', value: '3.4', icon: Route, tone: 'accent' },
          { label: 'Sessions Analyzed', value: '12,543', icon: Users, tone: 'info' },
          { label: 'Top Journey', value: '/ → /pricing', icon: TrendingUp, tone: 'success' },
          { label: 'Avg Time', value: '4m 12s', icon: Clock, tone: 'warning' },
      ]}
      analysis={<PathAnalysis websiteId={websiteId} dateRange={30} />}
    />
  );
}
