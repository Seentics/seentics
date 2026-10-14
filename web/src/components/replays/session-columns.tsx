import { Button } from '@/components/ui/button';

import { SortableHeader, ColumnDef, selectionColumn } from '@/components/ui/data-table';
import { SessionClientRowStack, SessionCountryVisual } from '@/components/replays/session-environment-visuals';
import { formatDuration, timeAgo, entryPathDisplay } from '@/features/replays/format';
import type { SessionRow } from '@/features/replays/list-types';
import { SIGNAL_META, TONE_CLASS, frustrationTone, signalChips } from '@/features/replays/analysis';
import { cn } from '@/lib/utils';

import { AlertTriangle, Clock, MousePointerClick, Play, Trash2 } from 'lucide-react';

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
          <span className="block max-w-[16rem] truncate font-mono text-[13px] text-foreground" title={title}>
            {display}
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
      id: 'frustration',
      header: 'Frustration',
      accessorFn: row => row.frustration_score ?? -1,
      size: 92,
      cell: ({ row }) => {
        const score = row.original.frustration_score;
        if (score == null) {
          return <span className="text-xs text-muted-foreground" title="Analysed once the session ends">—</span>;
        }
        return (
          <span
            className={cn('inline-flex min-w-[2.25rem] justify-center rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums', TONE_CLASS[frustrationTone(score)])}
            title="Frustration score, 0-100"
          >
            {score}
          </span>
        );
      },
    },
    {
      id: 'signals',
      header: 'Signals',
      accessorFn: row => (row.has_errors ? 2 : 0) + (row.has_rage_clicks ? 1 : 0),
      size: 180,
      cell: ({ row }) => {
        const s = row.original;
        const chips = signalChips(s.signal_counts);
        // Analysed: the detected signals say more than the two ingest flags, and include them.
        if (chips.length) {
          return (
            <div className="flex flex-wrap items-center gap-1">
              {chips.slice(0, 3).map(c => (
                <span
                  key={c.type}
                  title={SIGNAL_META[c.type].description}
                  className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', SIGNAL_META[c.type].chip)}
                >
                  {c.label}
                  {c.count > 1 && <span className="tabular-nums opacity-80">{c.count}</span>}
                </span>
              ))}
              {chips.length > 3 && <span className="text-[11px] text-muted-foreground">+{chips.length - 3}</span>}
            </div>
          );
        }
        if (!s.has_errors && !s.has_rage_clicks) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }
        /* Two 6px dots stacked in the Location column used to carry this, which
           needed a tooltip to mean anything. Labelled chips say it outright. */
        return (
          <div className="flex flex-wrap items-center gap-1.5">
            {s.has_errors && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-700 dark:text-red-300">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                Errors
              </span>
            )}
            {s.has_rage_clicks && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300">
                <MousePointerClick className="h-3.5 w-3.5 shrink-0" />
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
