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
}: {
  cards: StatCard[];
  isLoading?: boolean;
  cols?: 2 | 3 | 4;
}) {
  const gridClass = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-4',
  }[cols];

  if (isLoading) {
    return (
      <div className={`grid ${gridClass} gap-4 mb-6`}>
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className="bg-card border border-border/60 rounded-lg p-5 shadow-sm">
            <Skeleton className="h-3 w-20 mb-4 rounded" />
            <Skeleton className="h-7 w-16 mb-2 rounded" />
            <Skeleton className="h-3 w-10 rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={`grid ${gridClass} gap-4 mb-6`}>
      {cards.map((card, i) => {
        const Icon = card.icon;
        return (
          <div key={i} className="bg-card border border-border/60 rounded-lg p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              {Icon && (
                <div className="w-7 h-7 rounded-md bg-muted/60 flex items-center justify-center shrink-0">
                  <Icon className={cn('h-3.5 w-3.5', card.iconColor ?? 'text-muted-foreground')} />
                </div>
              )}
              <span className="text-xs font-medium text-muted-foreground">{card.label}</span>
            </div>
            <p className={cn('text-2xl font-bold tracking-tight', card.valueColor ?? 'text-foreground')}>
              {typeof card.value === 'number' ? card.value.toLocaleString() : card.value}
            </p>
            {card.subtext && <p className="text-xs text-muted-foreground mt-1">{card.subtext}</p>}
          </div>
        );
      })}
    </div>
  );
}
