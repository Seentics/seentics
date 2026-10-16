'use client';

import { usePathSegment } from '@/lib/path-segment';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronRight, GitBranch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { AskAiButton } from '@/components/ai/AskAiButton';
import { askAbout } from '@/features/ai/ask-link';
import { DEFAULT_FUNNEL_DAYS, FunnelRangeSelect, funnelRangeLabel } from '@/components/funnels/FunnelRangeSelect';
import { useFunnelAnalytics, useFunnels } from '@/features/funnels/queries';

/**
 * A funnel's page: its header and range, then the report (components/funnels/FunnelReport),
 * which the landing page shows too.
 */

import { buildStepRows, type StepRow } from '@/features/funnels/format';
import { FunnelReport } from '@/components/funnels/FunnelReport';

export default function FunnelDetailPage() {
  const params = { websiteId: usePathSegment(1) ?? '', funnelId: usePathSegment(3) ?? '' };
  const router = useRouter();
  const websiteId = params?.websiteId as string;
  const funnelId = params?.funnelId as string;

  const { data: funnels = [], isLoading: funnelsLoading } = useFunnels(websiteId);
  const [days, setDays] = useState<number>(DEFAULT_FUNNEL_DAYS);
  const { data: analyticsData, isLoading: analyticsLoading } = useFunnelAnalytics(funnelId, days, websiteId);

  const funnel = funnels.find(f => f.id === funnelId);
  const analytics = analyticsData?.analytics?.[0];
  const totalStarts = analytics?.total_starts || 0;

  // Steps joined to their counts once, in order (features/funnels/format).
  const rows = useMemo<StepRow[]>(
    () => buildStepRows(funnel?.steps ?? [], analytics?.step_metrics ?? [], totalStarts),
    [funnel, analytics, totalStarts],
  );

  if (funnelsLoading) {
    return (
      <div className="mx-auto w-full max-w-[1440px] space-y-6 p-4 md:p-5 lg:px-6 lg:py-5">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-20 rounded-lg" />
        <Skeleton className="h-96 rounded-lg" />
      </div>
    );
  }

  if (!funnel) {
    return (
      <div className="mx-auto w-full max-w-[1440px] p-8">
        <div className="surface flex flex-col items-center justify-center px-6 py-16 text-center">
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <GitBranch className="h-6 w-6" />
          </span>
          <p className="text-sm font-semibold text-foreground">Funnel not found</p>
          <p className="mt-1 text-sm text-muted-foreground">
            It may have been deleted, or it belongs to another website.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-6 gap-1.5"
            onClick={() => router.push(`/websites/${websiteId}/funnels`)}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to funnels
          </Button>
        </div>
      </div>
    );
  }

  const windowText = funnel.conversion_window_hours
    ? funnel.conversion_window_hours >= 24 && funnel.conversion_window_hours % 24 === 0
      ? `${funnel.conversion_window_hours / 24} day${funnel.conversion_window_hours === 24 ? '' : 's'}`
      : `${funnel.conversion_window_hours} hour${funnel.conversion_window_hours === 1 ? '' : 's'}`
    : null;

  return (
    <div className="mx-auto w-full max-w-[1200px] p-4 md:p-5 lg:px-6 lg:py-5">
      <button
        type="button"
        onClick={() => router.push(`/websites/${websiteId}/funnels`)}
        className="mb-2 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        All funnels
      </button>
      <DashboardPageHeader
        websiteId={websiteId}
        title={funnel.name}
        description={funnel.description || `${rows.length} step${rows.length === 1 ? '' : 's'} · ${funnel.is_active ? 'Active' : 'Paused'}`}
      >
        <AskAiButton websiteId={websiteId} size="md" {...askAbout.funnel(funnel.name)} />
        <FunnelRangeSelect value={days} onChange={setDays} />
      </DashboardPageHeader>

      {(analyticsData?.warnings?.length ?? 0) > 0 && (
        <ul role="status" className="mb-4 space-y-1 text-sm text-amber-700 dark:text-amber-400">
          {analyticsData?.warnings?.map(warning => <li key={warning}>{warning}</li>)}
        </ul>
      )}

      <FunnelReport
        rows={rows}
        totalStarts={totalStarts}
        conversions={analytics?.total_conversions || 0}
        conversionRate={analytics?.conversion_rate || 0}
        dropOffRate={analytics?.drop_off_rate || 0}
        avgTimeToConvert={analytics?.avg_time_to_convert}
        rangeLabel={funnelRangeLabel(days)}
        loading={analyticsLoading}
      />

      <details className="group mt-4 text-xs text-muted-foreground">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1 font-medium transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
          <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" aria-hidden />
          How this is counted
        </summary>
        <p className="mt-2 max-w-3xl pl-[18px] leading-relaxed">
          Counted from page views and events. Visitors who have not agreed to tracking are followed within a single day only, so a journey that crosses midnight counts them at the step they reached before it.
          {windowText ? ` Each step has to follow the one before within ${windowText}.` : ''}
        </p>
      </details>
    </div>
  );
}
