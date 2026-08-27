'use client';

import type React from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Semantic tones for a stat tile.
 *
 * Call sites used to pass raw `iconColor` / `valueColor` classes, which is why the
 * tiles drifted: some pages coloured the icon but not the number, some coloured
 * neither, and the same meaning ("healthy", "failing") picked a different green or
 * red on every page. A tone names the meaning and this file owns the colour, so
 * every page renders the same thing.
 */
export type StatTone = 'default' | 'success' | 'info' | 'warning' | 'danger' | 'accent';

const TONES: Record<StatTone, { icon: string; value: string }> = {
  default: { icon: 'text-muted-foreground', value: 'text-foreground' },
  success: { icon: 'text-emerald-600 dark:text-emerald-400', value: 'text-emerald-600 dark:text-emerald-400' },
  info:    { icon: 'text-blue-600 dark:text-blue-400',       value: 'text-blue-600 dark:text-blue-400' },
  warning: { icon: 'text-amber-600 dark:text-amber-400',     value: 'text-amber-600 dark:text-amber-400' },
  danger:  { icon: 'text-rose-600 dark:text-rose-400',       value: 'text-rose-600 dark:text-rose-400' },
  accent:  { icon: 'text-indigo-600 dark:text-indigo-400',   value: 'text-indigo-600 dark:text-indigo-400' },
};

export interface StatCard {
  label: string | React.ReactNode;
  value: string | number;
  icon?: React.ElementType;
  /** Semantic meaning of the figure. Drives both icon and value colour. */
  tone?: StatTone;
  /**
   * Drop to `default` tone when the figure is unremarkable — e.g. a failure count
   * of 0 should not be shouting in red. Ignored when tone is 'default'.
   */
  toneWhen?: boolean;
  subtext?: string;
}

export function StatCards({
  cards,
  isLoading,
  cols = 4,
  className,
  cardClassName,
}: {
  cards: StatCard[];
  isLoading?: boolean;
  cols?: 2 | 3 | 4;
  /** Extra classes on the grid wrapper (e.g. gap, margin). */
  className?: string;
  /** Extra classes on each stat tile. */
  cardClassName?: string;
}) {
  const gridClass = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4',
  }[cols];

  // `.surface` (globals.css) is the single definition of a flat panel — bg, border
  // and radius. This used to hardcode `border-none`, which is why the stat tiles on
  // automations, funnels, replays and heatmaps had no edge while the overview's
  // SummaryCards did.
  const tileBase = 'surface p-4 sm:p-5';

  if (isLoading) {
    return (
      <div className={cn('grid gap-3 sm:gap-4 mb-6', gridClass, className)}>
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className={cn(tileBase, cardClassName)}>
            <Skeleton className="h-3 w-20 mb-4 rounded-lg" />
            <Skeleton className="h-7 w-16 mb-2 rounded-lg" />
            <Skeleton className="h-3 w-10 rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn('grid gap-3 sm:gap-4 mb-6', gridClass, className)}>
      {cards.map((card, i) => {
        const Icon = card.icon;
        const tone = TONES[card.toneWhen === false ? 'default' : (card.tone ?? 'default')];
        return (
          <div key={i} className={cn(tileBase, cardClassName)}>
            <div className="flex items-center gap-2 mb-2.5">
              {Icon && (
                <div className="w-8 h-8 rounded-lg bg-muted/70 border border-border flex items-center justify-center shrink-0">
                  <Icon className={cn('h-3.5 w-3.5', tone.icon)} />
                </div>
              )}
              {typeof card.label === 'string' ? (
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground leading-tight">
                  {card.label}
                </span>
              ) : (
                <div className="text-[11px] font-medium text-muted-foreground leading-tight min-w-0">
                  {card.label}
                </div>
              )}
            </div>
            {/* One size at every breakpoint. It used to scale up to 1.75rem, which
                made long figures dominate the tile and read differently per page. */}
            <p className={cn('text-xl font-bold tracking-tight tabular-nums', tone.value)}>
              {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
            </p>
            {card.subtext && <p className="text-xs text-muted-foreground mt-1">{card.subtext}</p>}
          </div>
        );
      })}
    </div>
  );
}
