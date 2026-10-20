import { cn } from '@/lib/utils';
import { formatDuration, worstTransition, type StepRow } from '@/features/funnels/format';
import { Skeleton } from '@/components/ui/skeleton';
import { useT } from '@/lib/i18n';

/**
 * A funnel's report, read top to bottom as three answers:
 *
 *   1. How did it do? Four plain figures, no icons or tints.
 *   2. Where do people leave? One sentence naming the worst transition — the only colour
 *      here, because it is the one thing worth pulling the eye to.
 *   3. What happened at each step? A row per step with a bar for its share of everyone
 *      who entered; between each pair, a faint band narrowing from one bar to the next
 *      (the people who carried on) carrying the share that continued and how many left.
 *
 * Shared by the funnel page and the landing page's shot of it, so the picture on the
 * landing page is the page people get. `fixedLayout` drops the breakpoint prefixes for
 * the shot, whose breakpoints would resolve against the browser, not its design width.
 */
export function FunnelReport({
  rows, totalStarts, conversions, conversionRate, dropOffRate, avgTimeToConvert, rangeLabel, loading = false, fixedLayout = false,
}: {
  rows: StepRow[];
  totalStarts: number;
  conversions: number;
  conversionRate: number;
  dropOffRate: number;
  avgTimeToConvert?: number;
  rangeLabel?: string;
  loading?: boolean;
  fixedLayout?: boolean;
}) {
  const t = useT().funnels.report;
  const worst = worstTransition(rows);
  const dropped = Math.max(totalStarts - conversions, 0);
  return (
    <>
      {/* 1. How did it do. */}
      <section aria-label={t.summary} className={cn('surface grid', fixedLayout ? 'grid-cols-4' : 'grid-cols-2 md:grid-cols-4')}>
        <Figure label={t.entered} value={totalStarts.toLocaleString()} loading={loading} />
        <Figure
          label={t.completed}
          value={conversions.toLocaleString()}
          note={avgTimeToConvert ? t.onAverage(formatDuration(avgTimeToConvert)) : undefined}
          loading={loading}
          className="border-l border-border"
        />
        <Figure
          label={t.conversionRate}
          value={`${conversionRate.toFixed(1)}%`}
          note={rangeLabel}
          loading={loading}
          className={fixedLayout ? 'border-l border-border' : 'border-t border-border md:border-l md:border-t-0'}
        />
        <Figure
          label={t.dropOffRate}
          value={`${dropOffRate.toFixed(1)}%`}
          note={dropped > 0 ? t.people(dropped.toLocaleString()) : undefined}
          loading={loading}
          className={fixedLayout ? 'border-l border-border' : 'border-l border-t border-border md:border-t-0'}
        />
      </section>

      {/* 2. Where do people leave. */}
      {worst && !loading && (
        <p className="mt-5 flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground">
          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden />
          <span>
            {t.mostLeaveBefore}{' '}
            <span className="font-medium text-foreground">{worst.from.name}</span> {t.and}{' '}
            <span className="font-medium text-foreground">{worst.to.name}</span>{t.afterTo}:{' '}
            <span className="font-medium text-amber-700 dark:text-amber-400">
              {t.share(`${worst.to.dropOffRate.toFixed(1)}%`, worst.to.dropOff.toLocaleString())}
            </span>{' '}
            {t.doNotCarryOn}
          </span>
        </p>
      )}

      {/* 3. Each step: the funnel itself. */}
      <section aria-labelledby="funnel-steps" className="surface mt-5 overflow-hidden">
        <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-3">
          <h2 id="funnel-steps" className="text-sm font-semibold text-foreground">{t.steps}</h2>
          <p className="text-[11px] text-muted-foreground">{t.barHint}</p>
        </div>

        {rows.length === 0 ? (
          <p className="py-14 text-center text-sm text-muted-foreground">{t.noSteps}</p>
        ) : (
          <div className="overflow-x-auto">
            <ol className="min-w-[560px] px-5 py-4">
              <li aria-hidden className={cn(STEP_GRID, 'pb-2 text-[11px] text-muted-foreground')}>
                <span>{t.step}</span>
                <span />
                <span className="text-right">{t.visitors}</span>
                <span className="text-right">{t.ofEntries}</span>
              </li>
              {rows.map((row, i) => {
                const next = rows[i + 1];
                const width = Math.max(row.entryRate, 0.6);
                const nextWidth = next ? Math.max(next.entryRate, 0.6) : 0;
                const nextIsWorst = next && worst?.to.id === next.id;
                return (
                  <li key={row.id}>
                    <div className={cn(STEP_GRID, 'items-center py-1')}>
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border text-[10px] font-medium tabular-nums text-muted-foreground">
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium text-foreground" title={row.name}>{row.name}</p>
                          {row.condition && (
                            <p className="truncate font-mono text-[11px] text-muted-foreground" title={row.condition}>{row.condition}</p>
                          )}
                        </div>
                      </div>
                      <div className="h-7 rounded-md bg-muted/50">
                        <div
                          className="h-full rounded-md bg-primary transition-[width] duration-500"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                      <span className="text-right text-[13px] font-semibold tabular-nums text-foreground">
                        {loading ? '—' : row.count.toLocaleString()}
                      </span>
                      <span className="text-right text-[12px] tabular-nums text-muted-foreground">{row.entryRate.toFixed(1)}%</span>
                    </div>

                    {next && (
                      <div className={cn(STEP_GRID, 'h-10 items-center')}>
                        <span />
                        {/* The narrowing from this bar to the next: the people who carried on. */}
                        <div className="relative h-full">
                          <svg viewBox="0 0 100 10" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
                            <polygon points={`0,0 ${width},0 ${nextWidth},10 0,10`} className="fill-primary/15" />
                          </svg>
                          <span
                            className={cn(
                              'absolute left-3 top-1/2 -translate-y-1/2 whitespace-nowrap text-[11px] tabular-nums',
                              nextIsWorst ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground',
                            )}
                          >
                            <span className={cn('font-semibold', nextIsWorst ? '' : 'text-foreground')}>
                              {(next.stepRate ?? 0).toFixed(1)}%
                            </span>{' '}
                            {t.continued} · {t.left(next.dropOff.toLocaleString())}
                          </span>
                        </div>
                        <span />
                        <span />
                      </div>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </section>

    </>
  );
}

/** Step list columns: name, the bar, visitors, share of entries. */
const STEP_GRID = 'grid grid-cols-[minmax(150px,220px)_1fr_80px_72px] gap-x-5';

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
