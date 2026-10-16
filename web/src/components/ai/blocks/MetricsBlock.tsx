import { TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDelta, formatValue } from '@/features/ai/format';
import type { DisplayBlock } from '@/features/ai/types';

type Props = { block: Extract<DisplayBlock, { kind: 'metrics' }>; className?: string };

/** Comparable figures with their period-over-period change. */
export function MetricsBlock({ block, className }: Props) {
  if (!block.items.length) return null;
  return (
    // One strip with hairlines between the figures, like the dashboard's summaries.
    <div className={cn('grid grid-cols-2 overflow-hidden rounded-xl border border-border sm:grid-cols-3', className)}>
      {block.items.map((m, i) => {
        const up = (m.delta ?? 0) >= 0;
        return (
          <div key={m.label} className={cn('px-4 py-3', i > 0 && 'border-l border-border', i >= 3 && 'border-t sm:border-l')}>
            <p className="truncate text-xs text-muted-foreground">{m.label}</p>
            <p className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">
              {formatValue(m.value, m.format)}
            </p>
            {/* Null and zero are different: null means the previous period is unknown. */}
            {m.delta != null && (
              <p className={cn('mt-0.5 flex items-center gap-1 text-xs',
                up ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400')}>
                {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {formatDelta(m.delta)}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
