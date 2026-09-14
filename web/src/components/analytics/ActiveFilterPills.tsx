import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ActiveFilterPillsProps {
  /** The applied filters, keyed by dimension. Renders nothing when empty. */
  filters: Record<string, unknown>;
  onRemove: (key: string) => void;
  onClearAll: () => void;
  label?: string;
  clearAllLabel?: string;
  className?: string;
}

/**
 * The row of applied analytics filters, each removable.
 *
 * Presentational: it is handed the filter object and two callbacks and owns no state, so
 * the same row works above the overview, above a report, or in a fixture-driven demo.
 *
 * Rendering nothing for an empty object is part of the contract rather than the caller's
 * job — every call site had the same `Object.keys(...).length > 0` guard around it, which
 * is a detail of what this component *is*.
 */
export function ActiveFilterPills({
  filters,
  onRemove,
  onClearAll,
  label = 'Active filters:',
  clearAllLabel = 'Clear all',
  className,
}: ActiveFilterPillsProps) {
  const entries = Object.entries(filters ?? {});
  if (entries.length === 0) return null;

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {entries.map(([key, value]) => (
        <button
          key={key}
          type="button"
          onClick={() => onRemove(key)}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
        >
          <span className="text-muted-foreground">{key}:</span>
          <span>{String(value)}</span>
          <X className="h-3 w-3" />
        </button>
      ))}
      <button
        type="button"
        onClick={onClearAll}
        className="text-xs font-medium text-muted-foreground underline transition-colors hover:text-foreground"
      >
        {clearAllLabel}
      </button>
    </div>
  );
}
