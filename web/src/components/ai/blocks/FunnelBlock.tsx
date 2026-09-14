import { cn } from '@/lib/utils';
import type { DisplayBlock } from '@/features/ai/types';

type Props = { block: Extract<DisplayBlock, { kind: 'funnel' }>; className?: string };

/** Funnel steps as proportional bars, each relative to the first step. */
export function FunnelBlock({ block, className }: Props) {
  const top = Math.max(...block.steps.map((s) => s.value), 1);
  if (!block.steps.length) return null;

  return (
    <div className={cn('space-y-2 rounded-xl border border-border bg-card p-3', className)}>
      {block.steps.map((step, i) => (
        <div key={`${step.label}-${i}`}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate text-foreground">{step.label}</span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              {step.value.toLocaleString()}
              {step.conversionRate != null && ` · ${(step.conversionRate * 100).toFixed(1)}%`}
            </span>
          </div>
          <div className="mt-1 h-2 w-full rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary transition-all"
              style={{ width: `${Math.max(2, (step.value / top) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
