'use client';

import { usePathSegment } from '@/lib/path-segment';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronRight, GitBranch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ReportPage } from '@/components/ui/linear-list';
import { AskAiButton } from '@/components/ai/AskAiButton';
import { askAbout } from '@/features/ai/ask-link';
import { DEFAULT_FUNNEL_DAYS, FunnelRangeSelect, funnelRangeLabel } from '@/components/funnels/FunnelRangeSelect';
import { useFunnelAnalytics, useFunnels } from '@/features/funnels/queries';
import { useT } from '@/lib/i18n';

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

  const all = useT();
  const t = all.funnels.detail;
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
          <p className="text-sm font-semibold text-foreground">{t.notFound}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t.notFoundBody}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="mt-6 gap-1.5"
            onClick={() => router.push(`/websites/${websiteId}/funnels`)}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t.back}
          </Button>
        </div>
      </div>
    );
  }

  const windowText = funnel.conversion_window_hours
    ? funnel.conversion_window_hours >= 24 && funnel.conversion_window_hours % 24 === 0
      ? t.days(funnel.conversion_window_hours / 24)
      : t.hours(funnel.conversion_window_hours)
    : null;

  return (
    <ReportPage
      title={funnel.name}
      parent={{ label: t.parent, onClick: () => router.push(`/websites/${websiteId}/funnels`) }}
      description={funnel.description || t.stepsStatus(rows.length, funnel.is_active)}
      websiteId={websiteId}
      width="max-w-[1200px]"
      actions={<>
        <AskAiButton websiteId={websiteId} size="md" {...askAbout.funnel(funnel.name, all.ai.ask)} />
        <FunnelRangeSelect value={days} onChange={setDays} />
      </>}
    >
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
        rangeLabel={funnelRangeLabel(days, all.funnels.ranges)}
        loading={analyticsLoading}
      />

      <details className="group mt-4 text-xs text-muted-foreground">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1 font-medium transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
          <ChevronRight className="h-3.5 w-3.5 transition-transform group-open:rotate-90" aria-hidden />
          {t.howCounted}
        </summary>
        <p className="mt-2 max-w-3xl pl-[18px] leading-relaxed">
          {t.howCountedBody}
          {windowText ? t.window(windowText) : ''}
        </p>
      </details>
    </ReportPage>
  );
}
