'use client';

import type React from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { useT } from '@/lib/i18n';

/**
 * The figures at the top of a dashboard page: one panel, split by hairlines.
 *
 * Every page draws its headline numbers with this, so they read the same everywhere: a
 * sentence-case label, the figure in the text colour, and a line of context under it. Colour is
 * kept for meaning — a failure count that is not zero is red — rather than given to each tile
 * in turn, which is how the same blue came to mean sessions on one page and revenue on another.
 */
export interface StatCard {
  label: string;
  value: string | number;
  /** `danger`: the figure is a problem (failures, errors). Red unless `toneWhen` is false. */
  tone?: 'default' | 'danger';
  /** Set false when the figure is unremarkable, e.g. 0 failures should not be red. */
  toneWhen?: boolean;
  /** One line of context under the figure: the period, what it counts, a comparison. */
  subtext?: string;
  /** A change against the previous period, beside the context line. */
  delta?: React.ReactNode;
  /** A pulsing dot before the label, for a figure that is live. */
  live?: boolean;
}

const COLS = {
  2: 'grid-cols-2',
  3: 'grid-cols-2 md:grid-cols-3',
  4: 'grid-cols-2 md:grid-cols-4',
  6: 'grid-cols-2 md:grid-cols-3 xl:grid-cols-6',
} as const;

/**
 * Hairlines between cells: the grid's 1px gaps over the border colour, each cell on the card
 * colour. On phones a lone last cell spans the row, so no empty gap shows.
 */
const GRID = 'grid gap-px overflow-hidden rounded-lg bg-border';
const CELL = 'min-w-0 bg-card px-5 py-4 [&:last-child:nth-child(odd)]:col-span-2 md:[&:last-child:nth-child(odd)]:col-span-1';

export function StatCards({
  cards,
  isLoading,
  cols = 4,
  className,
}: {
  cards: StatCard[];
  isLoading?: boolean;
  cols?: keyof typeof COLS;
  /** Extra classes on the panel (spacing). */
  className?: string;
}) {
  const summary = useT().dashboard.summary;
  if (isLoading) {
    return (
      <section aria-label={summary} aria-busy className={cn(GRID, COLS[cols], 'mb-4', className)}>
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className={CELL}>
            <Skeleton className="h-3 w-20 rounded" />
            <Skeleton className="mt-2.5 h-7 w-16 rounded" />
            <Skeleton className="mt-2 h-3 w-24 rounded" />
          </div>
        ))}
      </section>
    );
  }

  return (
    <section aria-label={summary} className={cn(GRID, COLS[cols], 'mb-4', className)}>
      {cards.map((card) => {
        const danger = card.tone === 'danger' && card.toneWhen !== false;
        return (
          <div key={card.label} role="group" aria-label={card.label} className={CELL}>
            <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
              {card.live && (
                <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75 motion-reduce:hidden" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
              )}
              {card.label}
            </p>
            <p className={cn('mt-1 truncate text-2xl font-semibold tracking-tight tabular-nums', danger ? 'text-rose-600 dark:text-rose-400' : 'text-foreground')}>
              {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
            </p>
            {(card.subtext || card.delta) && (
              <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                {card.delta}
                {card.subtext && <span className="truncate">{card.subtext}</span>}
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
