'use client';

import { usePathSegment } from '@/lib/path-segment';


import { PathAnalysis, usePathAnalysis } from '@/components/analytics/PathAnalysis';
import { DashboardPageHeader } from '@/components/dashboard-header';
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
            label: 'Avg path length',
            value: metrics?.pages_per_session != null ? metrics.pages_per_session.toFixed(1) : loading,
          },
          {
            label: 'Sessions analyzed',
            value: metrics?.sessions != null ? metrics.sessions.toLocaleString() : loading,
          },
          { label: 'Top journey', value: paths ? (paths.top_journey ?? loading) : loading },
          {
            label: 'Avg time',
            value: metrics?.avg_session_time != null ? formatDuration(metrics.avg_session_time) : loading,
          },
      ]}
      analysis={<PathAnalysis websiteId={websiteId} dateRange={DAYS} />}
    />
  );
}
