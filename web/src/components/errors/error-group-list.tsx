import type React from 'react';
import { Bug } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ERROR_EVENTS_COL, ERROR_SEEN_COL, ErrorGroupRow } from './error-group-row';
import type { ErrorGroup } from '@/features/errors/types';

export interface ErrorGroupListProps {
  groups: ErrorGroup[];
  onOpen?: (fingerprint: string) => void;
  isLoading?: boolean;
  /** Shapes the empty copy — "no unresolved errors" is good news, "nothing here" is not. */
  status?: string;
  now?: number;
  /** Card toolbar slots, laid out like DataTable's: a title on the left, search on the right. */
  toolbarLeft?: React.ReactNode;
  toolbarRight?: React.ReactNode;
  className?: string;
}

/**
 * The list of faults, with its own loading and empty states.
 *
 * Both states live here rather than in the page because they are part of what this list
 * *is*, and a recording that films a loading frame should get the real one.
 */
export function ErrorGroupList({
  groups, onOpen, isLoading, status = 'unresolved', now, toolbarLeft, toolbarRight, className,
}: ErrorGroupListProps) {
  const maxEvents = Math.max(0, ...groups.map((g) => g.event_count));

  // The same surface, toolbar and column header as DataTable on the other pages.
  return (
    <div className={cn('surface overflow-hidden', className)}>
      {(toolbarLeft || toolbarRight) && (
        <div className="border-b border-border bg-muted/5 px-4 py-3">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 items-center gap-4">{toolbarLeft}</div>
            {toolbarRight && <div className="flex shrink-0 flex-wrap items-center gap-2">{toolbarRight}</div>}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 border-b border-border bg-muted/20 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="flex-1 pl-7">Error</span>
        <span className={cn('shrink-0 text-right', ERROR_EVENTS_COL)}>Events</span>
        <span className={cn('shrink-0 text-right', ERROR_SEEN_COL)}>Last seen</span>
      </div>

      {isLoading ? (
        [0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 border-b border-border px-4 py-4 last:border-0">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))
      ) : !groups.length ? (
        <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
            <Bug className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="mt-3 font-medium text-foreground">
            {status === 'unresolved' ? 'No unresolved errors' : 'Nothing here'}
          </p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {status === 'unresolved'
              ? 'Uncaught errors from your visitors will appear here as they happen.'
              : 'Try a different status or a wider date range.'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {groups.map((g) => (
            <ErrorGroupRow
              key={g.fingerprint}
              group={g}
              share={maxEvents > 0 ? g.event_count / maxEvents : 0}
              now={now}
              onOpen={onOpen ? () => onOpen(g.fingerprint) : undefined}
            />
          ))}
        </div>
      )}
    </div>
  );
}
