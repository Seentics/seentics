'use client';

import { ReportPage } from '@/components/ui/linear-list';
import { AlertsBanner } from '@/components/ai/AlertsBanner';
import { InsightsCard } from '@/components/ai/InsightsCard';
import { RecommendationsPanel } from '@/components/ai/RecommendationsPanel';
import { usePathSegment } from '@/lib/path-segment';
import { useT } from '@/lib/i18n';

/**
 * The AI's full read of the site: unusual activity, today's insight, and what to do next with the
 * measured results of changes already made. The dashboard shows three lines of it; this is the rest.
 */
export default function AiReportsPage() {
  const websiteId = usePathSegment(1) ?? '';
  const t = useT().ai.reports;

  return (
    <ReportPage
      title={t.title}
      description={t.description}
      websiteId={websiteId}
      bodyClassName="space-y-4"
    >
      <AlertsBanner websiteId={websiteId} />
      <InsightsCard websiteId={websiteId} />
      <RecommendationsPanel websiteId={websiteId} />
    </ReportPage>
  );
}
