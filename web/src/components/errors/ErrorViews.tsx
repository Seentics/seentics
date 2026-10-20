'use client';

import { Bug } from 'lucide-react';
import {
  CollectionRow, CollectionTable, GroupedRows, type CollectionColumn, type CollectionGroup,
} from '@/components/ui/collection';
import { MessageLine } from '@/components/errors/error-group-row';
import { relativeTime } from '@/features/errors/format';
import { ERROR_BUCKETS, errorBucket } from '@/features/errors/insights';
import type { ErrorGroup } from '@/features/errors/types';
import { cn } from '@/lib/utils';

export interface ErrorLayoutProps {
  groups: ErrorGroup[];
  /** Where the listed period starts, for sorting errors into New, Getting worse and so on. */
  periodStart: number;
  /** One plain-words line on what the error is doing in the period. */
  lineFor: (g: ErrorGroup) => string;
  now?: number;
  onOpen: (fingerprint: string) => void;
}

const BUCKET_GROUPS: CollectionGroup[] = ERROR_BUCKETS.map((b) => ({
  id: b.id, label: b.label, icon: <span aria-hidden className={cn('size-2 rounded-full', b.dot)} />,
}));

const key = (g: ErrorGroup) => g.fingerprint;
const countOf = (g: ErrorGroup) => g.window?.count ?? g.event_count;

function Message({ group, onOpen, className }: { group: ErrorGroup; onOpen: (fp: string) => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onOpen(group.fingerprint); }}
      title={group.message}
      className={cn('min-w-0 truncate text-left text-[13px] focus-visible:underline focus-visible:outline-none', className)}
    >
      <MessageLine message={group.message} />
    </button>
  );
}

function StatusTag({ group }: { group: ErrorGroup }) {
  if (group.status === 'unresolved') return null;
  return <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[11px] capitalize text-foreground/75">{group.status}</span>;
}

/** Grouped by what each error is doing: new, getting worse, on checkout or signup, steady… */
export function ErrorList({ groups, periodStart, lineFor, now, onOpen }: ErrorLayoutProps) {
  const busiest = Math.max(1, ...groups.map(countOf));
  return (
    <GroupedRows
      items={groups}
      getKey={key}
      groups={BUCKET_GROUPS}
      groupOf={(g) => errorBucket(g, periodStart)}
      renderRow={(g) => (
        <CollectionRow onOpen={() => onOpen(g.fingerprint)} className="min-h-[52px]">
          <Bug aria-hidden className="size-3.5 shrink-0 text-destructive/70" />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex min-w-0 items-center gap-2"><Message group={g} onOpen={onOpen} /><StatusTag group={g} /></span>
            <span className="truncate text-xs text-muted-foreground">{lineFor(g)}</span>
          </span>
          <span className="hidden w-28 shrink-0 md:block">
            <span className="block text-right text-[12.5px] tabular-nums text-foreground">{countOf(g).toLocaleString()}</span>
            {/* How much of the list's errors this one is: the count alone does not say. */}
            <span aria-hidden className="mt-1 block h-1 overflow-hidden rounded-full bg-border">
              <span className="block h-1 rounded-full bg-destructive/60" style={{ width: `${Math.max(4, Math.round((countOf(g) / busiest) * 100))}%` }} />
            </span>
          </span>
          <span className="w-16 shrink-0 text-right text-xs text-muted-foreground">{relativeTime(g.last_seen, now)}</span>
        </CollectionRow>
      )}
    />
  );
}

/** Every figure side by side: for sorting by how often, how many visitors, or where. */
export function ErrorTable({ groups, periodStart, now, onOpen, sortedBy }: ErrorLayoutProps & { sortedBy: string }) {
  const bucketLabel = (g: ErrorGroup) => ERROR_BUCKETS.find((b) => b.id === errorBucket(g, periodStart))!;
  const columns: CollectionColumn<ErrorGroup>[] = [
    { id: 'message', header: 'Error', cell: (g) => <span className="flex min-w-0 items-center gap-2"><Message group={g} onOpen={onOpen} /><StatusTag group={g} /></span> },
    {
      id: 'trend', header: 'Trend', width: '170px',
      cell: (g) => {
        const b = bucketLabel(g);
        return <span className="flex items-center gap-2 text-foreground/80"><span aria-hidden className={cn('size-1.5 rounded-full', b.dot)} />{b.label}</span>;
      },
    },
    { id: 'count', header: 'Occurrences', width: '110px', align: 'right', sorted: sortedBy === 'count', cell: (g) => <span className="tabular-nums text-foreground/80">{countOf(g).toLocaleString()}</span> },
    { id: 'visitors', header: 'Visitors', width: '90px', align: 'right', sorted: sortedBy === 'visitors', cell: (g) => <span className="tabular-nums text-foreground/80">{g.window ? g.window.sessions.toLocaleString() : '—'}</span> },
    {
      id: 'page', header: 'Page', width: '180px',
      cell: (g) => <span className="font-mono text-[11.5px] text-foreground/75" title={(g.window?.pages ?? [g.last_page_path]).join(', ')}>{g.last_page_path || '—'}</span>,
    },
    {
      id: 'source', header: 'Source', width: '180px',
      cell: (g) => <span className="font-mono text-[11.5px] text-muted-foreground" title={g.source_file}>{g.source_file ? `${g.source_file.split('/').pop()}${g.line_no != null ? `:${g.line_no}` : ''}` : '—'}</span>,
    },
    { id: 'first', header: 'First seen', width: '100px', align: 'right', sorted: sortedBy === 'new', cell: (g) => <span className="text-xs text-muted-foreground">{relativeTime(g.first_seen, now)}</span> },
    { id: 'last', header: 'Last seen', width: '100px', align: 'right', sorted: sortedBy === 'recent', cell: (g) => <span className="text-xs text-muted-foreground">{relativeTime(g.last_seen, now)}</span> },
  ];
  return <CollectionTable label="Errors" items={groups} getKey={key} columns={columns} onOpen={(g) => onOpen(g.fingerprint)} minWidth={1100} />;
}
