import { Button } from '@/components/ui/button';

import { SortableHeader, ColumnDef, selectionColumn } from '@/components/ui/data-table';
import { SessionCountryVisual } from '@/components/replays/session-environment-visuals';
import { formatDuration, timeAgo, entryPathDisplay } from '@/features/replays/format';
import type { SessionRow } from '@/features/replays/list-types';
import { FRUSTRATED_MIN_SCORE, frustrationTone } from '@/features/replays/analysis';
import { cn } from '@/lib/utils';

import { Clock, Play, Trash2 } from 'lucide-react';

export interface SessionColumnsOptions {
  websiteId: string;
  onPlay: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
  /** Watch-only (an embed): no selection column and no delete button. */
  readOnly?: boolean;
  /** Disables the row actions while a delete is in flight. */
  isMutating?: boolean;
}

/**
 * Column definitions for the session table.
 *
 * A factory taking callbacks rather than a constant, because three of these cells need
 * to navigate or delete — behaviour that belongs to whoever is showing the table, not to
 * the column. Keeping it out of the page means the same table can be rendered by a
 * shared report or a demo route with different (or absent) actions.
 */
export function sessionColumns({
  websiteId, onPlay, onDelete, isMutating, readOnly = false,
}: SessionColumnsOptions): ColumnDef<SessionRow>[] {
  return [

    ...(readOnly ? [] : [selectionColumn<SessionRow>()]),
    {
      id: 'country',
      accessorKey: 'country',
      header: ({ column }) => <SortableHeader column={column}>Location</SortableHeader>,
      size: 140,
      cell: ({ row }) => <SessionCountryVisual country={row.original.country} />,
    },
    {
      id: 'duration',
      header: ({ column }) => <SortableHeader column={column}>Duration</SortableHeader>,
      accessorKey: 'duration_seconds',
      size: 118,
      cell: ({ row }) => {
        const v = row.original.duration_seconds;
        return (
          <div>
            <span className="text-sm font-semibold tabular-nums tracking-tight text-foreground">
              {v > 0 ? formatDuration(v) : '—'}
            </span>
            {/* `pages_viewed` was already on the row type and simply never rendered.
                It is what separates a one-page bounce from a real journey of the
                same length. */}
            <p className="text-[11px] text-muted-foreground">
              {row.original.pages_viewed} {row.original.pages_viewed === 1 ? 'page' : 'pages'}
            </p>
          </div>
        );
      },
    },
    {
      id: 'summary',
      header: 'What happened',
      // Sorts by frustration: the score is what the dot shows.
      accessorFn: row => row.frustration_score ?? -1,
      size: 560,
      cell: ({ row }) => {
        const s = row.original;
        const score = s.frustration_score;
        const text = sessionLine(s, websiteId);
        return (
          <div className="flex min-w-0 max-w-[44rem] items-center gap-2">
            <span
              className={cn('h-2 w-2 shrink-0 rounded-full', score == null ? 'bg-muted-foreground/30' : DOT_CLASS[frustrationTone(score)])}
              title={score == null ? 'Analysed once the session ends' : `Frustration score ${score}/100`}
            />
            <span
              className={cn('truncate text-sm', score != null && score >= FRUSTRATED_MIN_SCORE ? 'text-foreground' : 'text-muted-foreground')}
              title={text}
            >
              {text}
            </span>
          </div>
        );
      },
    },
    {
      id: 'when',
      header: ({ column }) => <SortableHeader column={column}>Recorded</SortableHeader>,
      accessorKey: 'start_time',
      size: 104,
      cell: ({ getValue }) => (
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
          <Clock className="size-3.5 shrink-0 opacity-60" aria-hidden />
          {timeAgo(getValue() as string)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      size: 120,
      cell: ({ row }) => (
        <div className="flex justify-end items-center gap-1 pr-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 bg-primary/10 px-3 text-xs font-semibold text-primary hover:bg-primary/15 hover:text-primary"
            title="Watch replay"
            onClick={(e) => {
              e.stopPropagation();
              onPlay(row.original.session_id);
            }}
          >
            <Play className="h-3 w-3 fill-current" />
            Watch
          </Button>
          {!readOnly && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              title="Delete session"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(row.original.session_id);
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ),
    }
  ];
}

const DOT_CLASS: Record<ReturnType<typeof frustrationTone>, string> = {
  none: 'bg-emerald-500',
  low: 'bg-amber-400',
  medium: 'bg-orange-500',
  high: 'bg-red-500',
};

/** One line for the list: the server's summary, else what the ingest flags and page count say. */
export function sessionLine(
  s: Pick<SessionRow, 'summary' | 'has_errors' | 'has_rage_clicks' | 'pages_viewed' | 'entry_page' | 'frustration_score'>,
  websiteId: string,
): string {
  if (s.summary) return s.summary;
  const pages = `${s.pages_viewed} page${s.pages_viewed === 1 ? '' : 's'} from ${entryPathDisplay(s.entry_page, websiteId).display}`;
  if (s.has_errors && s.has_rage_clicks) return `Hit errors and rage-clicked · ${pages}`;
  if (s.has_errors) return `Hit an error · ${pages}`;
  if (s.has_rage_clicks) return `Rage-clicked · ${pages}`;
  return s.frustration_score != null ? `Browsed ${pages} — no friction` : `Browsed ${pages}`;
}
