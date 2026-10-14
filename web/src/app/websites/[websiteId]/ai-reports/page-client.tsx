'use client';

import { DashboardPageHeader } from '@/components/dashboard-header';
import { AlertsBanner } from '@/components/ai/AlertsBanner';
import { InsightsCard } from '@/components/ai/InsightsCard';
import { RecommendationsPanel } from '@/components/ai/RecommendationsPanel';
import { usePathSegment } from '@/lib/path-segment';

/**
 * The AI's full read of the site: unusual activity, today's insight, and what to do next with the
 * measured results of changes already made. The dashboard shows three lines of it; this is the rest.
 */
export default function AiReportsPage() {
  const websiteId = usePathSegment(1) ?? '';

  return (
    <div className="space-y-4">
      <DashboardPageHeader
        title="AI Reports"
        description="Unusual activity, today's insights, and what to fix next — with the results of what you changed."
        websiteId={websiteId}
      />
      <AlertsBanner websiteId={websiteId} />
      <InsightsCard websiteId={websiteId} />
      <RecommendationsPanel websiteId={websiteId} />
    </div>
  );
}
