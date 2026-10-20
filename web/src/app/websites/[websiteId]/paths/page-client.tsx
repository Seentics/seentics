'use client';

import { usePathSegment } from '@/lib/path-segment';


import { PathAnalysis, usePathAnalysis } from '@/components/analytics/PathAnalysis';
import { StatCards } from '@/components/seentics-ui/StatCards';
import { ReportPage } from '@/components/ui/linear-list';
import { useDashboardData } from '@/features/analytics/queries';
import { useT } from '@/lib/i18n';

const DAYS = 30;

function formatDuration(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  return m ? `${m}m ${s % 60}s` : `${s}s`;
}

export default function PathsPage() {
  const websiteId = usePathSegment(1) ?? '';
  const t = useT().analytics.paths;
  // These four used to be fixed strings ('12,543' sessions, '/ → /pricing', …) shown on
  // every site. They are the site's own numbers over the same window as the analysis.
  const { data: dashboard } = useDashboardData(websiteId, DAYS);
  const { data: paths } = usePathAnalysis(websiteId, DAYS);
  const metrics = dashboard?.metrics;
  const loading = '—';

  return (
    <ReportPage
      title={t.title}
      description={t.description}
      websiteId={websiteId}
      width="max-w-[1200px]"
    >
      <StatCards
        cards={[
          {
            label: t.avgPathLength,
            value: metrics?.pages_per_session != null ? metrics.pages_per_session.toFixed(1) : loading,
          },
          {
            label: t.sessionsAnalyzed,
            value: metrics?.sessions != null ? metrics.sessions.toLocaleString() : loading,
          },
          { label: t.topJourney, value: paths ? (paths.top_journey ?? loading) : loading },
          {
            label: t.avgTime,
            value: metrics?.avg_session_time != null ? formatDuration(metrics.avg_session_time) : loading,
          },
        ]}
      />
      <PathAnalysis websiteId={websiteId} dateRange={DAYS} />
    </ReportPage>
  );
}
