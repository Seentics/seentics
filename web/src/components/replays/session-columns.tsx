import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable, SortableHeader, ColumnDef, selectionColumn } from '@/components/ui/data-table';
import { SessionClientRowStack, SessionCountryVisual } from '@/components/replays/session-environment-visuals';
import { formatDuration, timeAgo, entryPathDisplay } from '@/features/replays/format';
import type { SessionRow } from '@/features/replays/list-types';
import { cn } from '@/lib/utils';
import { AlertTriangle, Clock, MousePointerClick, Play, Trash2 } from 'lucide-react';

export interface SessionColumnsOptions {
  websiteId: string;
  onPlay: (sessionId: string) => void;
  onDelete: (sessionId: string) => void;
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
  websiteId, onPlay, onDelete, isMutating,
}: SessionColumnsOptions): ColumnDef<SessionRow>[] {
  return [

    selectionColumn<SessionRow>(),
    {
      id: 'country',
      accessorKey: 'country',
      header: ({ column }) => <SortableHeader column={column}>Location</SortableHeader>,
      size: 140,
      cell: ({ row }) => <SessionCountryVisual country={row.original.country} compact />,
    },
    {
      id: 'client',
      header: 'Client',
      accessorFn: row => `${row.browser}|${row.os}|${row.device}`,
      size: 200,
      cell: ({ row }) => {
        const s = row.original;
        return <SessionClientRowStack browser={s.browser} os={s.os} device={s.device} />;
      },
    },
    {
      id: 'entry_page',
      header: 'Entry page',
      accessorKey: 'entry_page',
      size: 220,
      cell: ({ getValue }) => {
        const { display, title } = entryPathDisplay(getValue() as string, websiteId);
        return (
          <span
            className="inline-flex max-w-full min-w-0 items-center rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 font-mono text-[11px] leading-snug text-foreground sm:text-xs"
            title={title}
          >
            <span className="truncate">{display}</span>
          </span>
        );
      },
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
      id: 'signals',
      header: 'Signals',
      accessorFn: row => (row.has_errors ? 2 : 0) + (row.has_rage_clicks ? 1 : 0),
      size: 132,
      cell: ({ row }) => {
        const s = row.original;
        if (!s.has_errors && !s.has_rage_clicks) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }
        /* Two 6px dots stacked in the Location column used to carry this, which
           needed a tooltip to mean anything. Labelled chips say it outright. */
        return (
          <div className="flex flex-wrap items-center gap-1">
            {s.has_errors && (
              <span className="inline-flex items-center gap-1 rounded-lg border border-red-500/30 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-red-700 dark:text-red-300">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                Errors
              </span>
            )}
            {s.has_rage_clicks && (
              <span className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">
                <MousePointerClick className="h-3 w-3 shrink-0" />
                Rage
              </span>
            )}
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
            size="icon"
            className="h-9 w-9 text-foreground hover:bg-muted"
            title="Watch replay"
            onClick={(e) => {
              e.stopPropagation();
              onPlay(row.original.session_id);
            }}
          >
            <Play className="h-3.5 w-3.5 fill-current" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            title="Delete session"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(row.original.session_id);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    }
  ];
}
