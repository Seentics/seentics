import { Bug } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ErrorGroupRow } from './error-group-row';
import type { ErrorGroup } from '@/features/errors/types';

export interface ErrorGroupListProps {
  groups: ErrorGroup[];
  onOpen?: (fingerprint: string) => void;
  isLoading?: boolean;
  /** Shapes the empty copy — "no unresolved errors" is good news, "nothing here" is not. */
  status?: string;
  now?: number;
  className?: string;
}

/**
 * The list of faults, with its own loading and empty states.
 *
 * Both states live here rather than in the page because they are part of what this list
 * *is*, and a recording that films a loading frame should get the real one.
 */
export function ErrorGroupList({
  groups, onOpen, isLoading, status = 'unresolved', now, className,
}: ErrorGroupListProps) {
  if (isLoading) {
    return (
      <div className={cn('space-y-2', className)}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-xl bg-muted/50" />
        ))}
      </div>
    );
  }

  if (!groups.length) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center',
          className,
        )}
      >
        <Bug className="h-8 w-8 text-muted-foreground/50" />
        <p className="mt-3 font-medium text-foreground">
          {status === 'unresolved' ? 'No unresolved errors' : 'Nothing here'}
        </p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {status === 'unresolved'
            ? 'Uncaught errors from your visitors will appear here as they happen.'
            : 'Try a different status or a wider date range.'}
        </p>
      </div>
    );
  }

  return (
    <div className={cn('divide-y divide-border overflow-hidden rounded-xl border border-border', className)}>
      {groups.map((g) => (
        <ErrorGroupRow
          key={g.fingerprint}
          group={g}
          now={now}
          onOpen={onOpen ? () => onOpen(g.fingerprint) : undefined}
        />
      ))}
    </div>
  );
}
