'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Play } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { listSessions } from '@/features/replays/api';
import { SESSION_GROUP_META, inSessionGroup } from '@/features/replays/groups';
import { timeAgo } from '@/features/replays/format';
import type { SessionRow } from '@/features/replays/list-types';
import type { ReplayListParams, SessionGroup } from '@/features/replays/types';
import { sessionLine } from '@/components/replays/session-columns';
import { cn } from '@/lib/utils';

const PREVIEW = 10;

export interface SessionGroupsProps {
  websiteId: string;
  /** The page's filters (range, device, search), applied inside every group. */
  filters: ReplayListParams;
  /** Per-group totals from the list summary; the demo passes counts it worked out itself. */
  counts: Partial<Record<SessionGroup, number>> | undefined;
  /** Demo rows: grouped in the browser instead of asked for. */
  demoRows?: SessionRow[];
  onPlay: (sessionId: string) => void;
  /** "Show all": narrow the table above to this group. */
  onShowAll: (group: SessionGroup) => void;
  className?: string;
}

/**
 * Sessions by what kind of visit they were — smooth, gave up, errors, rage clicks… — each a
 * row with its count that opens into its most recent sessions, one line each.
 */
export function SessionGroups({ websiteId, filters, counts, demoRows, onPlay, onShowAll, className }: SessionGroupsProps) {
  const [open, setOpen] = useState<SessionGroup | null>(null);
  const groups = SESSION_GROUP_META.filter((g) => (counts?.[g.id] ?? 0) > 0);
  if (!counts || groups.length === 0) return null;

  return (
    <Card className={cn("divide-y divide-border border border-border bg-card", className)}>
      <div className="px-4 py-3">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">Session groups</h3>
        <p className="text-xs text-muted-foreground">What kind of visit each session was. Open a group to see its sessions.</p>
      </div>
      {groups.map((g) => (
        <div key={g.id}>
          <button
            type="button"
            onClick={() => setOpen(open === g.id ? null : g.id)}
            aria-expanded={open === g.id}
            className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/40"
          >
            <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform', open === g.id && 'rotate-90')} />
            <span className={cn('h-2 w-2 shrink-0 rounded-full', g.dot)} />
            <span className="text-sm font-medium">{g.label}</span>
            <span className="hidden truncate text-xs text-muted-foreground sm:inline">{g.description}</span>
            <span className="ml-auto shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold tabular-nums">
              {(counts[g.id] ?? 0).toLocaleString()}
            </span>
          </button>
          {open === g.id && (
            <GroupSessions
              websiteId={websiteId}
              group={g.id}
              filters={filters}
              total={counts[g.id] ?? 0}
              demoRows={demoRows}
              onPlay={onPlay}
              onShowAll={() => onShowAll(g.id)}
            />
          )}
        </div>
      ))}
    </Card>
  );
}

function GroupSessions({
  websiteId, group, filters, total, demoRows, onPlay, onShowAll,
}: {
  websiteId: string; group: SessionGroup; filters: ReplayListParams; total: number;
  demoRows?: SessionRow[]; onPlay: (id: string) => void; onShowAll: () => void;
}) {
  const query = useQuery({
    queryKey: ['session-group', websiteId, group, filters],
    queryFn: () => listSessions(websiteId, { ...filters, group, limit: PREVIEW, offset: 0 }),
    enabled: !demoRows && !!websiteId,
    staleTime: 60 * 1000,
  });

  const rows: SessionRow[] = demoRows
    ? demoRows.filter((r) => inSessionGroup(r, group)).slice(0, PREVIEW)
    : (query.data?.sessions ?? []).map((s) => ({
        id: s.sessionId, session_id: s.sessionId, country: s.country, browser: s.browser, os: s.os,
        device: s.device, entry_page: s.entryPage, duration_seconds: s.durationSeconds,
        pages_viewed: s.pagesViewed, has_errors: Boolean(s.hasErrors), has_rage_clicks: s.hasRageClicks,
        start_time: s.startedAt, frustration_score: s.frustrationScore ?? null,
        signal_counts: s.signalCounts ?? null, summary: s.summary ?? null,
      }));

  if (!demoRows && query.isLoading) {
    return <div className="px-11 pb-3 text-xs text-muted-foreground">Loading…</div>;
  }
  if (query.isError) {
    return <div className="px-11 pb-3 text-xs text-destructive">Could not load these sessions.</div>;
  }

  return (
    <div className="bg-muted/20 pb-2">
      <ul>
        {rows.map((r) => (
          <li key={r.session_id}>
            <button
              type="button"
              onClick={() => onPlay(r.session_id)}
              className="group flex w-full items-center gap-3 px-11 py-1.5 text-left hover:bg-muted/50"
            >
              <span className="min-w-0 flex-1 truncate text-sm" title={sessionLine(r, websiteId)}>
                {sessionLine(r, websiteId)}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(r.start_time)}</span>
              <Play className="h-3.5 w-3.5 shrink-0 text-muted-foreground group-hover:text-primary" />
            </button>
          </li>
        ))}
      </ul>
      {total > rows.length && (
        <button type="button" onClick={onShowAll} className="ml-11 mt-1 text-xs font-medium text-primary hover:underline">
          Show all {total.toLocaleString()} in the table above
        </button>
      )}
    </div>
  );
}
