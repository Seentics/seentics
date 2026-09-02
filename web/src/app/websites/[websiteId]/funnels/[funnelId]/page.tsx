'use client';

import { useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ArrowDownRight,
  GitBranch,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCards } from '@/components/seentics-ui/StatCards';
import { useFunnelAnalytics, useFunnels } from '@/lib/analytics-api';
import { cn } from '@/lib/utils';

/**
 * A funnel's analytics.
 *
 * The previous version showed each step as an isolated progress bar, then repeated
 * the same percentages in a "Step Conversion" card beside it, then dumped each step's
 * condition as `JSON.stringify(..., null, 2)` in a third card. Three panels, two of
 * them saying the same thing and one of them unreadable.
 *
 * This is one funnel instead. Every step carries its own numbers inline, and the two
 * figures that actually matter are both present: what share of *entrants* reached this
 * step, and what share of the *previous* step continued. The second one was never
 * shown, and it is the one that tells you which transition is broken — a step can look
 * healthy against total entries while losing most of the people who reached it.
 */

/** A step's condition, as something readable rather than a JSON blob. */
function conditionLabel(step: { type?: string; condition?: { page?: string; event?: string; custom?: string } }): string | null {
  const c = step.condition;
  if (!c) return null;
  return c.page || c.event || c.custom || null;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ${Math.round(seconds % 60)}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

type StepRow = {
  id: string;
  name: string;
  type: string;
  condition: string | null;
  count: number;
  /** Share of everyone who entered the funnel. */
  entryRate: number;
  /** Share of the previous step that continued — undefined on the first step. */
  stepRate?: number;
  dropOff: number;
  dropOffRate: number;
};

export default function FunnelDetailPage() {
  const params = useParams();
  const router = useRouter();
  const websiteId = params?.websiteId as string;
  const funnelId = params?.funnelId as string;

  const { data: funnels = [], isLoading: funnelsLoading } = useFunnels(websiteId);
  const { data: analyticsData, isLoading: analyticsLoading } = useFunnelAnalytics(funnelId, 30, websiteId);

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
        dropOff: metric?.drop_off ?? 0,
        dropOffRate: metric?.drop_off_rate ?? 0,
      };
    });
  }, [funnel, analytics, totalStarts]);

  /** The transition that loses the most people — the reason you opened this page. */
  const worst = useMemo(() => {
    const candidates = rows.slice(0, -1).filter(r => r.dropOff > 0);
    if (!candidates.length) return null;
    const step = candidates.reduce((a, b) => (b.dropOff > a.dropOff ? b : a));
    const next = rows[rows.indexOf(step) + 1];
    return next ? { step, next } : null;
  }, [rows]);

  if (funnelsLoading) {
    return (
      <div className="mx-auto w-full max-w-[1440px] space-y-6 p-4 md:p-6 lg:p-8">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <StatCards cards={[]} isLoading />
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

  return (
    <div className="mx-auto w-full max-w-[1440px] p-4 md:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 mb-3 h-8 gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => router.push(`/websites/${websiteId}/funnels`)}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to funnels
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="truncate text-2xl font-bold tracking-tight text-foreground">{funnel.name}</h1>
              <Badge variant={funnel.is_active ? 'default' : 'secondary'} className="shrink-0 text-[10px]">
                {funnel.is_active ? 'Active' : 'Paused'}
              </Badge>
            </div>
            {funnel.description ? (
              <p className="mt-1 text-sm text-muted-foreground">{funnel.description}</p>
            ) : null}
          </div>
          <p className="shrink-0 pt-1.5 text-xs text-muted-foreground">Last 30 days</p>
        </div>
      </div>

      <StatCards
        isLoading={analyticsLoading}
        cards={[
          { label: 'Entered funnel', value: totalStarts, icon: Users },
          {
            label: 'Completed',
            value: analytics?.total_conversions || 0,
            icon: Target,
            subtext: analytics?.avg_time_to_convert
              ? `${formatDuration(analytics.avg_time_to_convert)} to convert on average`
              : undefined,
          },
          {
            label: 'Conversion rate',
            value: `${(analytics?.conversion_rate || 0).toFixed(1)}%`,
            icon: TrendingUp,
            tone: 'accent',
          },
          {
            label: 'Drop-off rate',
            value: `${(analytics?.drop_off_rate || 0).toFixed(1)}%`,
            icon: TrendingDown,
          },
        ]}
      />

      {/*
        The single worst transition, called out rather than left to be spotted — and
        the one place colour is left on this page, because it is the one thing worth
        pulling the eye to. Amber rather than orange, and only here.
      */}
      {worst && (
        <div className="surface mb-6 flex flex-wrap items-center gap-x-2 gap-y-1 px-5 py-3.5 text-sm">
          <ArrowDownRight className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="font-semibold text-foreground">Biggest drop-off</span>
          <span className="text-muted-foreground">
            between <span className="font-medium text-foreground">{worst.step.name}</span> and{' '}
            <span className="font-medium text-foreground">{worst.next.name}</span> —
          </span>
          <span className="font-semibold text-amber-700 dark:text-amber-400">
            {worst.step.dropOff.toLocaleString()} people ({worst.step.dropOffRate.toFixed(1)}%)
          </span>
        </div>
      )}

      {/*
        The funnel.

        Rebuilt around the transition rather than the step. Every funnel view — ours
        included, and every competitor's — draws a row per step with a bar that gets
        shorter, and files the loss away as a line of text underneath. But nobody
        loses visitors *at* a step; they lose them *between* two. So the band between
        each pair of steps is now the loudest element on the page: one bar split into
        the people who carried on and the people who did not, both labelled.

        The step rows keep a share-of-entries bar, which is the absolute view and the
        thing a decreasing-bar chart is actually good at. Two views, each doing the
        job it is suited to, instead of one doing both badly.
      */}
      <Card className="overflow-hidden border border-border bg-card">
        <CardHeader className="border-b border-border px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold">Steps</CardTitle>
            <p className="text-xs text-muted-foreground">Bar width is the share of all entries</p>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="px-5 py-14 text-center text-sm text-muted-foreground">
              This funnel has no steps yet.
            </p>
          ) : (
            <ol>
              {rows.map((row, i) => {
                const isLast = i === rows.length - 1;
                const next = rows[i + 1];
                // A floor so a step that almost nobody reached is still a visible bar
                // rather than a sliver indistinguishable from zero.
                const width = Math.max(row.entryRate, 1.5);
                // The share of *this* step that carried on, which is what the band
                // below splits. Distinct from `row.stepRate`, which looks backwards.
                const continued = next && row.count > 0 ? (next.count / row.count) * 100 : 0;
                const isWorst = worst?.step.id === row.id;

                return (
                  <li key={row.id} className={cn(!isLast && 'border-b border-border')}>
                    <div className="flex items-start gap-4 px-5 py-4">
                      {/* The step number. There was a connector line here too, but
                          `flex-1` inside an `items-start` parent gave it no height, so
                          it rendered nothing — and the row dividers already carry the
                          sequence. */}
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-xs font-bold text-primary">
                        {i + 1}
                      </span>

                      <div className="min-w-0 flex-1">
                        {/* Name, what it matches, and the figures */}
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <span className="text-sm font-semibold text-foreground">{row.name}</span>
                            <Badge
                              variant="outline"
                              className="h-[18px] shrink-0 bg-background px-1.5 text-[10px] font-bold uppercase tracking-tight opacity-70"
                            >
                              {row.type}
                            </Badge>
                            {row.condition && (
                              // Replaces the JSON dump: the one thing anyone wanted
                              // out of it was the path or event name.
                              <code className="min-w-0 truncate rounded border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                                {row.condition}
                              </code>
                            )}
                          </div>

                          <div className="flex shrink-0 items-baseline gap-2">
                            <span className="text-base font-bold tabular-nums text-foreground">
                              {row.count.toLocaleString()}
                            </span>
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {row.entryRate.toFixed(1)}% of entries
                            </span>
                          </div>
                        </div>

                        {/* Bar */}
                        <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-muted">
                          {/* One soft tone for every step, with the last a shade
                              stronger. Full-strength primary on nine bars plus an
                              emerald endpoint was the loudest thing on the page and
                              made the numbers beside it harder to read. */}
                          <div
                            className={cn(
                              'h-full rounded-full transition-[width] duration-500',
                              isLast ? 'bg-primary/80' : 'bg-primary/45',
                            )}
                            style={{ width: `${width}%` }}
                          />
                        </div>

                      </div>
                    </div>

                    {/*
                      The transition. Indented to line up under the step it leaves, so
                      it reads as belonging between the two rather than to either one.
                    */}
                    {next && (
                      /*
                        One line, two numbers.
                        The first version of this band said five things: how many
                        reached this step, the percentage that continued, the
                        percentage that left, how many went on, and how many did not.
                        Only two of those are new — the step counts are already on the
                        rows above and below, and each percentage is the other's
                        complement. So it restated two facts five ways, which is what
                        made it hard to read.
                      */
                      <div
                        className={cn(
                          'flex items-center gap-3 border-t border-border py-2 pl-16 pr-5',
                          isWorst ? 'bg-amber-500/[0.06]' : 'bg-muted/25',
                        )}
                      >
                        <TrendingDown
                          className={cn(
                            'h-3.5 w-3.5 shrink-0',
                            isWorst ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground/50',
                          )}
                          aria-hidden
                        />

                        {/* The split, as a picture rather than a sentence. */}
                        <div className="flex h-1.5 w-28 shrink-0 overflow-hidden rounded-full bg-muted-foreground/15">
                          <div
                            className={cn(
                              'transition-[width] duration-500',
                              isWorst ? 'bg-amber-500/70' : 'bg-primary/55',
                            )}
                            style={{ width: `${continued}%` }}
                          />
                        </div>

                        <p className="min-w-0 text-xs text-muted-foreground">
                          <span className="font-semibold tabular-nums text-foreground">
                            {continued.toFixed(1)}%
                          </span>{' '}
                          continued
                          {row.dropOff > 0 && (
                            <>
                              {' · '}
                              <span className="tabular-nums">
                                {row.dropOff.toLocaleString()} dropped off
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
