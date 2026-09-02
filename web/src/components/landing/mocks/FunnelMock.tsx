'use client';

import { useMemo } from 'react';
import { ArrowDownRight, ArrowLeft, GitBranch, Target, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatCards } from '@/components/seentics-ui/StatCards';
import { cn } from '@/lib/utils';
import { demoFunnelAnalytics, demoFunnels } from '@/lib/demo';
import { MockSidebar } from './MockSidebar';

/**
 * A funnel's analytics page.
 *
 * Layout, card chrome and the step visualisation are lifted from
 * `app/websites/[websiteId]/funnels/[funnelId]/page.tsx`, and the numbers are the
 * demo funnel the live demo serves — so the drop-off story here is the one a visitor
 * sees if they click through to it. `StatCards` is the app's own component.
 *
 * The `lg:` prefixes of the real page are dropped for unprefixed equivalents:
 * breakpoints resolve against the browser viewport, not the mock's design width, so a
 * prefixed grid would reflow the shot on a narrower window.
 */
export function FunnelMock() {
  const { funnel, analytics } = useMemo(() => {
    const f = demoFunnels().funnels[0]!;
    return { funnel: f, analytics: demoFunnelAnalytics(f.id).analytics[0]! };
  }, []);

  const steps = funnel.steps;
  const metrics: Array<{ step: number; count: number; drop_off: number; drop_off_rate: number }> =
    analytics.step_metrics;

  return (
    <div className="flex h-full w-full bg-background text-foreground">
      <MockSidebar active="Funnels" />

      <main className="min-w-0 flex-1 overflow-hidden">
        <div className="mx-auto w-full max-w-[1200px] p-8">
          <div className="mb-6 flex items-center gap-3">
            <span className="flex h-8 items-center gap-1.5 px-2 text-sm font-medium text-muted-foreground">
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to Funnels
            </span>
          </div>

          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-primary" />
                <h1 className="text-xl font-bold text-foreground">{funnel.name}</h1>
                <Badge variant="default" className="text-[10px]">Active</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{funnel.description}</p>
            </div>
          </div>

          <StatCards
            cards={[
              // Only the conversion rate keeps a tone, matching the real page. Four
              // coloured figures in a row read as four warnings, not one summary.
              { label: 'Entered funnel', value: analytics.total_starts, icon: Users },
              { label: 'Completed', value: analytics.total_conversions, icon: Target },
              { label: 'Conversion rate', value: `${analytics.conversion_rate.toFixed(1)}%`, icon: TrendingUp, tone: 'accent' },
              { label: 'Drop-off rate', value: `${analytics.drop_off_rate.toFixed(1)}%`, icon: TrendingDown },
            ]}
          />

          {/* Biggest drop-off — the one place colour is left on this screen */}
          <div className="surface mb-6 flex items-center gap-2 px-5 py-3.5 text-sm">
            <ArrowDownRight className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span className="font-semibold text-foreground">Biggest drop-off</span>
            <span className="text-muted-foreground">
              between <span className="font-medium text-foreground">Home Page</span> and{' '}
              <span className="font-medium text-foreground">Feature Explore</span> —
            </span>
            <span className="font-semibold text-amber-700 dark:text-amber-400">
              43,245 people (50.6%)
            </span>
          </div>

          {/* The funnel */}
          <Card className="overflow-hidden border border-border bg-card">
            <CardHeader className="border-b border-border px-5 py-4">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-sm font-semibold">Steps</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Bar width is the share of all entries
                </p>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ol className="divide-y divide-border">
                {steps.map((step, i) => {
                  const metric = metrics.find((m) => m.step === i + 1);
                  const count = metric?.count ?? 0;
                  const entryRate = (count / analytics.total_starts) * 100;
                  const isLast = i === steps.length - 1;
                  const nextCount = metrics.find((m) => m.step === i + 2)?.count ?? 0;
                  // Share of *this* step that carried on — what the band below splits.
                  const continued = !isLast && count > 0 ? (nextCount / count) * 100 : 0;
                  // The demo funnel's worst transition is the first one.
                  const isWorst = i === 0;

                  return (
                    <li key={step.id} className={cn(!isLast && 'border-b border-border')}>
                      <div className="flex items-start gap-4 px-5 py-4">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-xs font-bold text-primary">
                          {i + 1}
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline justify-between gap-3">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="text-sm font-semibold text-foreground">{step.name}</span>
                              <Badge
                                variant="outline"
                                className="h-[18px] shrink-0 bg-background px-1.5 text-[10px] font-bold uppercase tracking-tight opacity-70"
                              >
                                {step.type}
                              </Badge>
                              <code className="min-w-0 truncate rounded border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                                {step.condition.page ?? step.condition.event}
                              </code>
                            </div>
                            <div className="flex shrink-0 items-baseline gap-2">
                              <span className="text-base font-bold tabular-nums text-foreground">
                                {count.toLocaleString()}
                              </span>
                              <span className="text-xs tabular-nums text-muted-foreground">
                                {entryRate.toFixed(1)}% of entries
                              </span>
                            </div>
                          </div>

                          {/* One soft tone, last step a shade stronger — matching the
                              real page, where full primary on every bar plus an
                              emerald endpoint left nothing quiet to read against. */}
                          <div className="mt-2.5 h-2.5 overflow-hidden rounded-full bg-muted">
                            <div
                              className={cn('h-full rounded-full', isLast ? 'bg-primary/80' : 'bg-primary/45')}
                              style={{ width: `${Math.max(entryRate, 1.5)}%` }}
                            />
                          </div>

                        </div>
                      </div>

                      {/* The loss between two steps, on one line — matching the real
                          page, where this is the element the design is built around. */}
                      {!isLast && (
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
                          />
                          <div className="flex h-1.5 w-28 shrink-0 overflow-hidden rounded-full bg-muted-foreground/15">
                            <div
                              className={cn(isWorst ? 'bg-amber-500/70' : 'bg-primary/55')}
                              style={{ width: `${continued}%` }}
                            />
                          </div>
                          <p className="min-w-0 text-xs text-muted-foreground">
                            <span className="font-semibold tabular-nums text-foreground">
                              {continued.toFixed(1)}%
                            </span>{' '}
                            continued
                            {(metric?.drop_off ?? 0) > 0 && (
                              <>
                                {' · '}
                                <span className="tabular-nums">
                                  {metric!.drop_off.toLocaleString()} dropped off
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
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
