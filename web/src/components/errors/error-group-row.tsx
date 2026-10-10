import { Bug } from 'lucide-react';
import { cn } from '@/lib/utils';
import { errorTypeOf, relativeTime } from '@/features/errors/format';
import type { ErrorGroup } from '@/features/errors/types';

/** Column widths, shared with the list's header so the two always line up. */
export const ERROR_EVENTS_COL = 'w-28';
export const ERROR_SEEN_COL = 'w-24';

export interface ErrorGroupRowProps {
  group: ErrorGroup;
  onOpen?: () => void;
  /** This fault's event count as a fraction of the busiest fault in the list, 0–1. */
  share?: number;
  /** Pinned by a recording so the rendered frame is deterministic. */
  now?: number;
  className?: string;
}

/**
 * The message with its error class picked out: `TypeError: x is undefined` renders the
 * class in the error colour and the rest as normal text. It replaces a bordered chip that
 * repeated the same word right beside the message.
 */
export function MessageLine({ message }: { message: string }) {
  const type = errorTypeOf(message);
  const prefix = `${type}:`;
  if (!message.startsWith(prefix)) return <>{message}</>;
  return (
    <>
      <span className="font-semibold text-destructive">{type}</span>
      <span className="text-foreground">{message.slice(type.length)}</span>
    </>
  );
}

/**
 * One fault in the list.
 *
 * Presentational: it receives a group and a callback and fetches nothing. That is what
 * lets the same component render live data in the dashboard and a fixture in a Remotion
 * scene, instead of the content engine keeping a hand-copied lookalike that drifts every
 * time this file changes.
 */
export function ErrorGroupRow({ group, onOpen, share = 0, now, className }: ErrorGroupRowProps) {
  const body = (
    <>
      <Bug className="mt-0.5 h-4 w-4 shrink-0 text-destructive/70" />
      <div className="min-w-0 flex-1">
        {/* Truncated, not wrapped: the list is scanned. The full text is in the detail. */}
        <p className="truncate text-sm font-medium">
          <MessageLine message={group.message} />
        </p>
        <p className="mt-0.5 flex items-center gap-2 truncate text-xs text-muted-foreground">
          <span className="truncate">
            {group.last_page_path || '—'}
            {group.source_file ? ` · ${group.source_file}` : ''}
            {group.line_no != null ? `:${group.line_no}` : ''}
          </span>
          {group.status !== 'unresolved' && (
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium capitalize text-foreground/80">
              {group.status}
            </span>
          )}
        </p>
      </div>
      <div className={cn('shrink-0 text-right', ERROR_EVENTS_COL)}>
        <p className="text-sm font-semibold tabular-nums text-foreground">
          {group.event_count.toLocaleString()}
        </p>
        {/* How much of the list's traffic this fault is — the count alone does not say. */}
        <div className="ml-auto mt-1 h-1 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-destructive/60"
            style={{ width: `${Math.max(4, Math.round(share * 100))}%` }}
          />
        </div>
      </div>
      <p className={cn('shrink-0 pt-px text-right text-[13px] text-muted-foreground', ERROR_SEEN_COL)}>
        {relativeTime(group.last_seen, now)}
      </p>
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
