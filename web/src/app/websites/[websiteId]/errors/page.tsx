'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Bug, Search, Video, Check, EyeOff, RotateCcw, ChevronLeft } from 'lucide-react';
import {
  useErrorGroup, useErrorGroups, useSetErrorStatus,
  errorTypeOf, relativeTime,
  type ErrorGroup, type ErrorStatus,
} from '@/lib/errors-api';
import { cn } from '@/lib/utils';

const RANGES = [
  { value: '1',  label: 'Last 24 hours' },
  { value: '7',  label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
];

const STATUSES = [
  { value: 'unresolved', label: 'Unresolved' },
  { value: 'resolved',   label: 'Resolved' },
  { value: 'ignored',    label: 'Ignored' },
  { value: 'all',        label: 'All' },
];

export default function ErrorsPage() {
  const params    = useParams();
  const router    = useRouter();
  const websiteId = params?.websiteId as string;

  const [days,   setDays]   = useState(7);
  const [status, setStatus] = useState('unresolved');
  const [search, setSearch] = useState('');
  /** Which group's detail panel is open. Null is the list. */
  const [openFingerprint, setOpenFingerprint] = useState<string | null>(null);

  const { data: groups, isLoading, error } = useErrorGroups(websiteId, {
    days,
    // The API treats an empty status as "every status"; the select says "all".
    status: status === 'all' ? '' : status,
    search,
  });

  if (openFingerprint) {
    return (
      <ErrorDetail
        websiteId={websiteId}
        fingerprint={openFingerprint}
        days={days}
        onBack={() => setOpenFingerprint(null)}
        onWatchReplay={(sessionId) =>
          router.push(`/websites/${websiteId}/replays/${sessionId}`)
        }
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <DashboardPageHeader
        title="Errors"
        description="Uncaught JavaScript errors from real visitors, grouped by fault."
        websiteId={websiteId}
      />

      <div className="flex flex-wrap items-center gap-2 px-4 pb-3 sm:px-6">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search message or file…"
            className="h-9 pl-8"
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="h-9 w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {RANGES.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <div className="px-4 pb-3 sm:px-6">
          <Alert variant="destructive">
            <AlertDescription>{(error as Error).message}</AlertDescription>
          </Alert>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 sm:px-6">
        {isLoading ? (
          <ListSkeleton />
        ) : !groups?.length ? (
          <EmptyState status={status} />
        ) : (
          <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
            {groups.map((g) => (
              <GroupRow key={g.fingerprint} group={g} onOpen={() => setOpenFingerprint(g.fingerprint)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function GroupRow({ group, onOpen }: { group: ErrorGroup; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-start gap-3 bg-card px-4 py-3 text-left transition-colors hover:bg-muted/50"
    >
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
        <p className="text-xs text-muted-foreground">{relativeTime(group.last_seen)}</p>
      </div>
    </button>
  );
}

function ErrorDetail({
  websiteId, fingerprint, days, onBack, onWatchReplay,
}: {
  websiteId: string;
  fingerprint: string;
  days: number;
  onBack: () => void;
  onWatchReplay: (sessionId: string) => void;
}) {
  const { data, isLoading } = useErrorGroup(websiteId, fingerprint, days);
  const setStatus = useSetErrorStatus(websiteId);
  const group = data?.group;

  const act = (status: ErrorStatus) => setStatus.mutate({ fingerprint, status });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 px-4 pt-4 sm:px-6">
        <Button variant="ghost" size="sm" onClick={onBack} className="h-8 gap-1 px-2">
          <ChevronLeft className="h-4 w-4" /> All errors
        </Button>
      </div>

      {isLoading || !group ? (
        <div className="px-4 py-6 sm:px-6"><ListSkeleton /></div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 sm:px-6">
          <div className="mt-3 rounded-xl border border-border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono text-[10px]">
                {errorTypeOf(group.message)}
              </Badge>
              <Badge variant="secondary" className="text-[10px] capitalize">{group.status}</Badge>
              <span className="text-xs text-muted-foreground">
                {group.event_count.toLocaleString()} occurrences · first seen{' '}
                {relativeTime(group.first_seen)} · last {relativeTime(group.last_seen)}
              </span>
            </div>
            {/* Wrapped here, unlike the list: this is the copy someone reads and pastes. */}
            <p className="mt-2 break-words font-medium text-foreground">{group.message}</p>
            {group.source_file && (
              <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
                {group.source_file}
                {group.line_no != null ? `:${group.line_no}` : ''}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm" variant="outline" className="h-8 gap-1.5"
                disabled={setStatus.isPending || group.status === 'resolved'}
                onClick={() => act('resolved')}
              >
                <Check className="h-3.5 w-3.5" /> Resolve
              </Button>
              <Button
                size="sm" variant="outline" className="h-8 gap-1.5"
                disabled={setStatus.isPending || group.status === 'ignored'}
                onClick={() => act('ignored')}
              >
                <EyeOff className="h-3.5 w-3.5" /> Ignore
              </Button>
              {group.status !== 'unresolved' && (
                <Button
                  size="sm" variant="ghost" className="h-8 gap-1.5"
                  disabled={setStatus.isPending}
                  onClick={() => act('unresolved')}
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Reopen
                </Button>
              )}
            </div>
          </div>

          <h3 className="mt-5 text-sm font-semibold text-foreground">Recent occurrences</h3>
          {!data?.samples.length ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No samples kept in this range — occurrences are retained for a shorter
              period than the counts above.
            </p>
          ) : (
            <div className="mt-2 space-y-2">
              {data.samples.map((s) => (
                <div key={s.id} className="rounded-xl border border-border bg-card p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs text-muted-foreground">
                      {relativeTime(s.occurred_at)} · {s.page_path || '—'}
                      {s.browser ? ` · ${s.browser}` : ''}
                      {s.device_type ? ` · ${s.device_type}` : ''}
                    </span>
                    {/* The whole point of building this here rather than buying it. */}
                    {s.session_id ? (
                      <Button
                        size="sm" variant="outline" className="h-7 gap-1.5 text-xs"
                        onClick={() => onWatchReplay(s.session_id!)}
                      >
                        <Video className="h-3.5 w-3.5" /> Watch replay
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">No replay recorded</span>
                    )}
                  </div>
                  {s.stack && (
                    <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-muted/50 p-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
                      {s.stack}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-16 animate-pulse rounded-xl bg-muted/50" />
      ))}
    </div>
  );
}

function EmptyState({ status }: { status: string }) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 text-center')}>
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
