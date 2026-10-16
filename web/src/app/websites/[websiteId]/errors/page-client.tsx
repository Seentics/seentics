'use client';

import { usePathSegment } from '@/lib/path-segment';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { usePermissions } from '@/hooks/use-permissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { GHOST_CONTROL } from '@/components/ui/ghost-control';
import { RangeSelect } from '@/components/ui/range-select';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ChevronLeft, Search } from 'lucide-react';
import { StatCards } from '@/components/seentics-ui/StatCards';
import { relativeTime } from '@/features/errors/format';
import { ErrorGroupDetail } from '@/components/errors/error-group-detail';
import { ErrorGroupList } from '@/components/errors/error-group-list';
import { useErrorGroup, useErrorGroups } from '@/features/errors/queries';
import { useSetErrorStatus } from '@/features/errors/mutations';
import { isDemo } from '@/lib/demo';
import { DEMO_REFERENCE_DATE } from '@/lib/demo/fixture-utils';
import { ListGroups, type ListGroup } from '@/components/ui/list-groups';
import { ERROR_GROUP_META, errorLine, inErrorGroup, type ErrorGroupId } from '@/features/errors/insights';
import type { ErrorGroup } from '@/features/errors/types';

/**
 * Route composition only.
 *
 * This file chooses what to show and owns route-specific concerns — the selected
 * fingerprint, the filters, and where "watch replay" navigates to. Data access lives in
 * `features/errors`, and every piece of markup below the filters is a component that
 * takes data as props. See `docs/component-and-data-architecture.md`.
 */

const RANGES = [
  { days: 1,  label: 'Last 24 hours' },
  { days: 7,  label: 'Last 7 days' },
  { days: 30, label: 'Last 30 days' },
] as const;

const STATUSES = [
  { value: 'unresolved', label: 'Unresolved' },
  { value: 'resolved',   label: 'Resolved' },
  { value: 'ignored',    label: 'Ignored' },
  { value: 'all',        label: 'All' },
];

export default function ErrorsPage() {
  const params = { websiteId: usePathSegment(1) ?? '' };
  const router    = useRouter();
  const websiteId = params?.websiteId as string;

  const [days,   setDays]   = useState(7);
  const [status, setStatus] = useState('unresolved');
  const [search, setSearch] = useState('');
  const [openFingerprint, setOpenFingerprint] = useState<string | null>(null);
  /** A group the list is narrowed to, from "Show all" below it. */
  const [groupFilter, setGroupFilter] = useState<ErrorGroupId | null>(null);

  // The API treats an empty status as "every status"; the select calls that "all".
  const filters = { days, status: status === 'all' ? '' : status, search };

  const { data: groups, isLoading, error } = useErrorGroups(websiteId, filters);
  const detail    = useErrorGroup(websiteId, openFingerprint, days);
  const setStatusMutation = useSetErrorStatus(websiteId);
  const { canEdit } = usePermissions(websiteId);

  // Demo data is dated against a fixed clock; relative times read against it too.
  const now = isDemo(websiteId) ? DEMO_REFERENCE_DATE.getTime() : undefined;

  // Summary of the groups the filters return.
  const list = groups ?? [];
  const rangeStart = (now ?? Date.now()) - days * 86_400_000;
  const newInRange = list.filter((g) => new Date(g.first_seen).getTime() >= rangeStart).length;
  const lastSeen = list.reduce<string | null>(
    (latest, g) => (!latest || g.last_seen > latest ? g.last_seen : latest), null,
  );

  const periodLabel = days === 1 ? 'in the last 24 hours' : `in the last ${days} days`;
  const lineFor = (g: ErrorGroup) => errorLine(g, rangeStart, periodLabel);
  const shownList = groupFilter ? list.filter((g) => inErrorGroup(g, groupFilter, rangeStart)) : list;
  const errorGroups: ListGroup[] = ERROR_GROUP_META.map((meta) => ({
    ...meta,
    items: list
      .filter((g) => inErrorGroup(g, meta.id, rangeStart))
      .map((g) => ({
        key: g.fingerprint,
        text: g.message,
        meta: g.window ? `${g.window.count.toLocaleString()}×` : undefined,
        onClick: () => setOpenFingerprint(g.fingerprint),
      })),
  }));

  const watchReplay = (sessionId: string) =>
    router.push(`/websites/${websiteId}/replays/${sessionId}`);

  if (openFingerprint) {
    return (
      <div className="w-full max-w-[1440px] mx-auto p-4 md:p-5 lg:px-6 lg:py-5">
        <Button
          variant="ghost" size="sm"
          onClick={() => setOpenFingerprint(null)}
          className="-ml-2 h-8 gap-1 px-2"
        >
          <ChevronLeft className="h-4 w-4" /> All errors
        </Button>
        {detail.isLoading || !detail.data?.group ? (
          <div className="mt-3 h-40 animate-pulse rounded-xl bg-muted/50" />
        ) : (
          <ErrorGroupDetail
            className="mt-3"
            group={detail.data.group}
            samples={detail.data.samples}
            now={now}
            isUpdating={setStatusMutation.isPending}
            onWatchReplay={watchReplay}
            onSetStatus={canEdit ? (next) =>
              setStatusMutation.mutate({ fingerprint: openFingerprint, status: next })
            : undefined}
          />
        )}
      </div>
    );
  }

  return (
    <div className="w-full max-w-[1440px] mx-auto p-4 md:p-5 lg:px-6 lg:py-5">
      <DashboardPageHeader
        title="Errors"
        description="Uncaught JavaScript errors from real visitors, grouped by fault."
        websiteId={websiteId}
      >
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className={cn(GHOST_CONTROL, 'h-8 w-auto gap-2 px-3 text-xs')}><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <RangeSelect value={days} onChange={setDays} ranges={RANGES} />
      </DashboardPageHeader>

      <StatCards
        isLoading={isLoading}
        cards={[
          { label: 'Error groups', value: list.length, tone: 'danger', toneWhen: list.length > 0 },
          { label: 'Occurrences', value: list.reduce((sum, g) => sum + g.event_count, 0) },
          { label: 'New in this range', value: newInRange },
          { label: 'Last error', value: lastSeen ? relativeTime(lastSeen, now) : '—' },
        ]}
      />

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{(error as Error).message}</AlertDescription>
        </Alert>
      )}

      <ErrorGroupList
        groups={shownList}
        lineFor={lineFor}
        isLoading={isLoading}
        status={status}
        now={now}
        onOpen={setOpenFingerprint}
        toolbarLeft={
          <div>
            <h3 className="font-semibold text-foreground">Error groups</h3>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {shownList.length} fault{shownList.length !== 1 ? 's' : ''} in this range
            </p>
          </div>
        }
        toolbarRight={
          <div className="flex items-center gap-2">
          {groupFilter && (
            <Button variant="secondary" size="sm" className="h-8 gap-1 text-xs" onClick={() => setGroupFilter(null)}>
              {ERROR_GROUP_META.find((g) => g.id === groupFilter)?.label} ×
            </Button>
          )}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search errors..."
              className="h-8 w-56 pl-8 text-xs"
            />
          </div>
          </div>
        }
      />

      <ListGroups
        className="mt-6"
        title="Error groups by trend"
        description="What each error is doing in this period. Open a group to see its errors."
        groups={errorGroups}
        onShowAll={(id) => { setGroupFilter(id as ErrorGroupId); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
      />
    </div>
  );
}
