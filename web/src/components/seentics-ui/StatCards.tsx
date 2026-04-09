'use client';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

export interface StatCard {
  label: string;
  value: string | number;
  icon?: React.ElementType;
  iconColor?: string;
  valueColor?: string;
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

  const tileBase =
    'bg-card border border-border/60 rounded-lg p-4 sm:p-5 shadow-sm';

  if (isLoading) {
    return (
      <div className={cn('grid gap-3 sm:gap-4 mb-6', gridClass, className)}>
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className={cn(tileBase, cardClassName)}>
            <Skeleton className="h-3 w-20 mb-4 rounded" />
            <Skeleton className="h-7 w-16 mb-2 rounded" />
            <Skeleton className="h-3 w-10 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn('grid gap-3 sm:gap-4 mb-6', gridClass, className)}>
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <div key={i} className={cn(tileBase, cardClassName)}>
            <div className="flex items-center gap-2 mb-2.5">
              {Icon && (
                <div className="w-8 h-8 rounded-md bg-muted/70 border border-border/50 flex items-center justify-center shrink-0">
                  <Icon className={cn('h-3.5 w-3.5', card.iconColor ?? 'text-muted-foreground')} />
                </div>
              )}
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground leading-tight">
                {card.label}
              </span>
            </div>
            <p className={cn('text-2xl sm:text-[1.75rem] font-bold tracking-tight tabular-nums', card.valueColor ?? 'text-foreground')}>
              {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
            </p>
            {card.subtext && <p className="text-xs text-muted-foreground mt-1">{card.subtext}</p>}
          </div>
        );
      })}
    </div>
  );
}
