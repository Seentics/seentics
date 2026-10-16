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
import { cn } from '@/lib/utils';

/**
 * A funnel's analytics, read top to bottom as three answers:
 *
 *   1. How did it do? Four plain figures, no icons or tints.
 *   2. Where do people leave? One sentence naming the worst transition — the only colour
 *      on the page, because it is the one thing worth pulling the eye to.
 *   3. What happened at each step? A column per step in one colour, the faint striped
 *      column behind it being everyone who reached the step before, so the loss is the
 *      gap you see rather than a second bar. The share that carried on sits between each
 *      pair. Then a table with the exact numbers.
 *
 * Losses are worked out from the step counts (previous minus this), not read from each
 * step's `drop_off`: the API reports that as the loss *into* a step while the demo data
 * reports the loss *out of* it, and the counts mean the same thing in both.
 */

/** A step's condition, as something readable rather than a JSON blob. */
import { conditionLabel, formatDuration, type StepRow } from '@/features/funnels/format';

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

  /**
   * Steps joined to their metrics once, here, rather than a `metrics.find()` inside
   * three separate render loops. `stepRate` is derived from the previous step's count,
   * which is why this needs to be a single pass over the ordered list.
   */
  const rows = useMemo<StepRow[]>(() => {
    const steps = funnel?.steps ?? [];
    const metrics = analytics?.step_metrics ?? [];

    return steps.map((step: any, i: number) => {
      const metric = metrics.find((m: any) => m.step === i + 1);
      const count = metric?.count ?? 0;
      const prev = i === 0 ? null : (metrics.find((m: any) => m.step === i)?.count ?? 0);

      return {
        id: step.id || `step-${i}`,
        name: step.name,
        type: step.type,
        condition: conditionLabel(step),
        count,
        entryRate: totalStarts > 0 ? (count / totalStarts) * 100 : 0,
        stepRate: prev == null ? undefined : prev > 0 ? (count / prev) * 100 : 0,
        // Lost on the way in from the step before.
        dropOff: prev == null ? 0 : Math.max(prev - count, 0),
        dropOffRate: prev == null || prev <= 0 ? 0 : (Math.max(prev - count, 0) / prev) * 100,
      };
    });
  }, [funnel, analytics, totalStarts]);

  /**
   * The transition that loses the largest share of the people who reached it — the
   * reason you opened this page. By share, not head count: the first transition always
   * loses the most people simply because the most people are there.
   */
  const worst = useMemo(() => {
    const candidates = rows.slice(1).filter(r => r.dropOff > 0);
    if (!candidates.length) return null;
    const to = candidates.reduce((a, b) => (b.dropOffRate > a.dropOffRate ? b : a));
    const from = rows[rows.indexOf(to) - 1];
    return from ? { from, to } : null;
  }, [rows]);

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

  const conversions = analytics?.total_conversions || 0;
  const dropped = Math.max(totalStarts - conversions, 0);
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

      {/* 1. How did it do. */}
      <section aria-label="Summary" className="surface grid grid-cols-2 md:grid-cols-4">
        <Figure label="Entered funnel" value={totalStarts.toLocaleString()} loading={analyticsLoading} />
        <Figure
          label="Completed"
          value={conversions.toLocaleString()}
          note={analytics?.avg_time_to_convert ? `${formatDuration(analytics.avg_time_to_convert)} on average` : undefined}
          loading={analyticsLoading}
          className="border-l border-border"
        />
        <Figure
          label="Conversion rate"
          value={`${(analytics?.conversion_rate || 0).toFixed(1)}%`}
          note={funnelRangeLabel(days)}
          loading={analyticsLoading}
          className="border-t border-border md:border-l md:border-t-0"
        />
        <Figure
          label="Drop-off rate"
          value={`${(analytics?.drop_off_rate || 0).toFixed(1)}%`}
          note={dropped > 0 ? `${dropped.toLocaleString()} people` : undefined}
          loading={analyticsLoading}
          className="border-l border-t border-border md:border-t-0"
        />
      </section>

      {/* 2. Where do people leave. */}
      {worst && !analyticsLoading && (
        <p className="mt-5 flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground">
          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
          <span>
            Most people leave between{' '}
            <span className="font-medium text-foreground">{worst.from.name}</span> and{' '}
            <span className="font-medium text-foreground">{worst.to.name}</span>:{' '}
            <span className="font-medium text-amber-700 dark:text-amber-400">
              {worst.to.dropOffRate.toFixed(1)}% of them ({worst.to.dropOff.toLocaleString()})
            </span>{' '}
            do not carry on.
          </span>
        </p>
      )}

      {/* 3. Each step. */}
      <section aria-labelledby="funnel-steps" className="surface mt-5 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-border px-5 py-3">
          <h2 id="funnel-steps" className="text-sm font-semibold text-foreground">Conversion by step</h2>
          <div className="flex items-center gap-4 text-[11px] text-muted-foreground" aria-hidden>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-[3px] bg-primary" /> Reached the step
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="funnel-ghost h-2.5 w-2.5 rounded-[3px]" /> Left before it
            </span>
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="py-14 text-center text-sm text-muted-foreground">This funnel has no steps yet.</p>
        ) : (
          <>
            <div className="overflow-x-auto px-5 pb-5 pt-6">
              <div className="flex items-stretch" style={{ minWidth: rows.length * 132 }}>
                {rows.map((row, i) => {
                  const prev = rows[i - 1];
                  const isWorst = worst?.to.id === row.id;
                  return (
                    <div key={row.id} className="contents">
                      {prev && (
                        <div className="flex w-14 shrink-0 flex-col items-center justify-center pt-8 sm:w-16">
                          <span
                            className={cn(
                              'text-[12px] font-semibold tabular-nums',
                              isWorst ? 'text-amber-700 dark:text-amber-400' : 'text-foreground',
                            )}
                          >
                            {(row.stepRate ?? 0).toFixed(1)}%
                          </span>
                          <ChevronRight className="mt-0.5 h-3.5 w-3.5 text-muted-foreground/70" aria-hidden />
                        </div>
                      )}
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-[15px] font-semibold tabular-nums text-foreground">
                            {analyticsLoading ? '—' : row.count.toLocaleString()}
                          </span>
                          <span className="text-[11px] tabular-nums text-muted-foreground">{row.entryRate.toFixed(1)}%</span>
                        </div>
                        <div className="relative mt-2 h-48 border-b border-border" aria-hidden>
                          {prev && (
                            <div
                              className="funnel-ghost absolute inset-x-0 bottom-0 rounded-t-[4px]"
                              style={{ height: `${Math.max(prev.entryRate, 1)}%` }}
                            />
                          )}
                          <div
                            className="absolute inset-x-0 bottom-0 rounded-t-[4px] bg-primary transition-[height] duration-500"
                            style={{ height: `${Math.max(row.entryRate, 1)}%` }}
                          />
                        </div>
                        <p className="mt-3 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">Step {i + 1}</p>
                        <p className="mt-0.5 truncate text-[13px] font-medium text-foreground" title={row.name}>{row.name}</p>
                        {row.condition && (
                          <p className="truncate font-mono text-[11px] text-muted-foreground" title={row.condition}>{row.condition}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="overflow-x-auto border-t border-border">
              <table className="w-full min-w-[620px] text-sm">
                <thead>
                  <tr className="text-left text-[11px] font-medium text-muted-foreground">
                    <th scope="col" className="px-5 py-2.5 font-medium">Step</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">Visitors</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">From previous</th>
                    <th scope="col" className="px-3 py-2.5 text-right font-medium">From start</th>
                    <th scope="col" className="px-5 py-2.5 text-right font-medium">Left before this step</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const isWorst = worst?.to.id === row.id;
                    return (
                      <tr key={row.id} className="border-t border-border">
                        <td className="px-5 py-3">
                          <div className="flex min-w-0 items-baseline gap-2.5">
                            <span className="w-4 shrink-0 text-[11px] tabular-nums text-muted-foreground">{i + 1}</span>
                            <span className="truncate font-medium text-foreground">{row.name}</span>
                            {row.condition && (
                              <code className="hidden truncate font-mono text-[11px] text-muted-foreground lg:inline">{row.condition}</code>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right font-medium tabular-nums text-foreground">{row.count.toLocaleString()}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">
                          {row.stepRate == null ? '—' : `${row.stepRate.toFixed(1)}%`}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-muted-foreground">{row.entryRate.toFixed(1)}%</td>
                        <td className="px-5 py-3 text-right tabular-nums">
                          {i === 0 ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <span className={isWorst ? 'font-medium text-amber-700 dark:text-amber-400' : 'text-muted-foreground'}>
                              {row.dropOff.toLocaleString()}
                              <span className="ml-1.5 text-[11px]">({row.dropOffRate.toFixed(1)}%)</span>
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

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

/** One of the summary's figures: a label, the number, and at most one quiet line under it. */
function Figure({ label, value, note, loading, className }: {
  label: string;
  value: string;
  note?: string;
  loading?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('px-5 py-4', className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-24 rounded-md" />
      ) : (
        <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums text-foreground">{value}</p>
      )}
      {note && !loading && <p className="mt-0.5 text-[11px] text-muted-foreground">{note}</p>}
    </div>
  );
}
