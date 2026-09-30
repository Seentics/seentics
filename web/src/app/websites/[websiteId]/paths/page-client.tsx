'use client';

import { usePathSegment } from '@/lib/path-segment';


import { PathAnalysis, usePathAnalysis } from '@/components/analytics/PathAnalysis';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { Route, Clock, TrendingUp, Users } from 'lucide-react';
import { PathsDashboardView } from '@/components/paths/PathsDashboardView';
import { useDashboardData } from '@/features/analytics/queries';

const DAYS = 30;

function formatDuration(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  return m ? `${m}m ${s % 60}s` : `${s}s`;
}

export default function PathsPage() {
  const websiteId = usePathSegment(1) ?? '';
  // These four used to be fixed strings ('12,543' sessions, '/ → /pricing', …) shown on
  // every site. They are the site's own numbers over the same window as the analysis.
  const { data: dashboard } = useDashboardData(websiteId, DAYS);
  const { data: paths } = usePathAnalysis(websiteId, DAYS);
  const metrics = dashboard?.metrics;
  const loading = '—';

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
          {
            label: 'Avg Path Length',
            value: metrics?.pages_per_session != null ? metrics.pages_per_session.toFixed(1) : loading,
            icon: Route,
            tone: 'accent',
          },
          {
            label: 'Sessions Analyzed',
            value: metrics?.sessions != null ? metrics.sessions.toLocaleString() : loading,
            icon: Users,
            tone: 'info',
          },
          { label: 'Top Journey', value: paths ? (paths.top_journey ?? loading) : loading, icon: TrendingUp, tone: 'success' },
          {
            label: 'Avg Time',
            value: metrics?.avg_session_time != null ? formatDuration(metrics.avg_session_time) : loading,
            icon: Clock,
            tone: 'warning',
          },
      ]}
      analysis={<PathAnalysis websiteId={websiteId} dateRange={DAYS} />}
    />
  );
}
