import { Bug } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { errorTypeOf, relativeTime } from '@/features/errors/format';
import type { ErrorGroup } from '@/features/errors/types';

export interface ErrorGroupRowProps {
  group: ErrorGroup;
  onOpen?: () => void;
  /** Pinned by a recording so the rendered frame is deterministic. */
  now?: number;
  className?: string;
}

/**
 * One fault in the list.
 *
 * Presentational: it receives a group and a callback and fetches nothing. That is what
 * lets the same component render live data in the dashboard and a fixture in a Remotion
 * scene, instead of the content engine keeping a hand-copied lookalike that drifts every
 * time this file changes.
 */
export function ErrorGroupRow({ group, onOpen, now, className }: ErrorGroupRowProps) {
  const body = (
    <>
      <Bug className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
            {errorTypeOf(group.message)}
          </Badge>
          {group.status !== 'unresolved' && (
            <Badge variant="secondary" className="shrink-0 text-[10px] capitalize">
              {group.status}
            </Badge>
          )}
        </div>
        {/* Truncated, not wrapped: the list is scanned. The full text is in the detail. */}
        <p className="mt-1 truncate font-medium text-foreground">{group.message}</p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {group.last_page_path || '—'}
          {group.source_file ? ` · ${group.source_file}` : ''}
          {group.line_no != null ? `:${group.line_no}` : ''}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="font-semibold tabular-nums text-foreground">
          {group.event_count.toLocaleString()}
        </p>
        <p className="text-xs text-muted-foreground">{relativeTime(group.last_seen, now)}</p>
      </div>
    </>
  );

  const shared = cn('flex w-full items-start gap-3 bg-card px-4 py-3 text-left', className);

  // Static when there is nowhere to go — a recording renders rows nobody clicks, and a
  // button that does nothing is still announced as one.
  if (!onOpen) return <div className={shared}>{body}</div>;

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(shared, 'transition-colors hover:bg-muted/50')}
    >
      {body}
    </button>
  );
}
