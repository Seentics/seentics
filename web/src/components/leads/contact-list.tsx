import { Inbox } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { relativeTime } from '@/features/errors/format';
import type { Contact } from '@/features/leads/types';

export interface ContactListProps {
  contacts: Contact[];
  total: number;
  offset: number;
  limit: number;
  isLoading?: boolean;
  /** True when a search or status filter is narrowing the list; shapes the empty copy. */
  filtered?: boolean;
  /** For the demo, whose sample data is dated against a fixed clock. */
  now?: number;
  onOpen: (contactId: string) => void;
  onPage: (offset: number) => void;
  toolbarLeft?: React.ReactNode;
  toolbarRight?: React.ReactNode;
  className?: string;
}

export const STATUS_TONE: Record<Contact['status'], string> = {
  new: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  contacted: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  archived: 'bg-muted text-muted-foreground',
};

/**
 * The inbox: one row per email address, newest activity first.
 *
 * Loading and empty states live here because they are part of what this list is. The
 * empty copy differs for "nothing yet" (point at how leads arrive) and "nothing matches".
 */
export function ContactList({
  contacts, total, offset, limit, isLoading, filtered, now, onOpen, onPage, toolbarLeft, toolbarRight, className,
}: ContactListProps) {
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total);

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
        <span className="flex-1">Contact</span>
        <span className="hidden w-24 shrink-0 text-right sm:block">Status</span>
        <span className="hidden w-20 shrink-0 text-right md:block">Submits</span>
        <span className="w-24 shrink-0 text-right">Last seen</span>
      </div>

      {isLoading ? (
        [0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 border-b border-border px-4 py-4 last:border-0">
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))
      ) : contacts.length === 0 ? (
        <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted">
            <Inbox className="h-5 w-5 text-muted-foreground" />
          </div>
          <p className="mt-3 text-sm font-medium">{filtered ? 'No contacts match' : 'No leads yet'}</p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            {filtered
              ? 'Try a different search or status.'
              : 'Add a form to a popup in Automations. Submissions appear here as visitors send them.'}
          </p>
        </div>
      ) : (
        contacts.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onOpen(c.id)}
            className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-0 hover:bg-muted/30 focus-visible:bg-muted/30 focus-visible:outline-none"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{c.email}</span>
              {c.name && <span className="block truncate text-xs text-muted-foreground">{c.name}</span>}
            </span>
            <span className="hidden w-24 shrink-0 justify-end sm:flex">
              <Badge variant="outline" className={cn('border-0 capitalize', STATUS_TONE[c.status])}>{c.status}</Badge>
            </span>
            <span className="hidden w-20 shrink-0 text-right text-sm tabular-nums md:block">{c.submission_count}</span>
            <span className="w-24 shrink-0 text-right text-xs text-muted-foreground">{relativeTime(c.last_submitted_at, now)}</span>
          </button>
        ))
      )}

      {total > limit && (
        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
          <span>{from}–{to} of {total}</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" className="h-7" disabled={offset === 0} onClick={() => onPage(Math.max(0, offset - limit))}>Previous</Button>
            <Button size="sm" variant="ghost" className="h-7" disabled={to >= total} onClick={() => onPage(offset + limit)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}
