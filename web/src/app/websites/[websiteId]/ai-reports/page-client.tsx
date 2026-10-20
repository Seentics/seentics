'use client';

import { Sparkles } from 'lucide-react';
import { ReportPage } from '@/components/ui/linear-list';
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
    <ReportPage
      icon={<Sparkles />}
      title="AI Reports"
      description="Unusual activity, today's insights, and what to fix next — with the results of what you changed."
      websiteId={websiteId}
      bodyClassName="space-y-4"
    >
      <AlertsBanner websiteId={websiteId} />
      <InsightsCard websiteId={websiteId} />
      <RecommendationsPanel websiteId={websiteId} />
    </ReportPage>
  );
}
