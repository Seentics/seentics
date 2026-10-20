'use client';

import { usePathSegment } from '@/lib/path-segment';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/hooks/use-permissions';
import { Button } from '@/components/ui/button';
import { RangeSelect } from '@/components/ui/range-select';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Bug, ChevronLeft } from 'lucide-react';
import {
  CollectionEmpty, CollectionSkeleton, FilterToolbar, LayoutSwitch, useLayoutPreference, type FilterField,
} from '@/components/ui/collection';
import { LIST_PAGE, PageBar, ViewTabs } from '@/components/ui/linear-list';
import { ErrorGroupDetail } from '@/components/errors/error-group-detail';
import { ErrorList, ErrorTable } from '@/components/errors/ErrorViews';
import { errorTypeOf } from '@/features/errors/format';
import { useErrorGroup, useErrorGroups } from '@/features/errors/queries';
import { useSetErrorStatus } from '@/features/errors/mutations';
import { isDemo } from '@/lib/demo';
import { DEMO_REFERENCE_DATE } from '@/lib/demo/fixture-utils';
import { ERROR_BUCKETS, errorBucket, errorLine, type ErrorBucket } from '@/features/errors/insights';
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

type Status = 'unresolved' | 'resolved' | 'ignored' | 'all';
type Sort = 'count' | 'visitors' | 'recent' | 'new';

const LAYOUTS = ['list', 'table'] as const;
type ErrorLayout = (typeof LAYOUTS)[number];

const SORTS: Record<Sort, { label: string; compare: (a: ErrorGroup, b: ErrorGroup) => number }> = {
  count: { label: 'Most frequent', compare: (a, b) => (b.window?.count ?? b.event_count) - (a.window?.count ?? a.event_count) },
  visitors: { label: 'Most visitors', compare: (a, b) => (b.window?.sessions ?? 0) - (a.window?.sessions ?? 0) },
  recent: { label: 'Last seen', compare: (a, b) => b.last_seen.localeCompare(a.last_seen) },
  new: { label: 'Newest', compare: (a, b) => b.first_seen.localeCompare(a.first_seen) },
};

export default function ErrorsPage() {
  const params = { websiteId: usePathSegment(1) ?? '' };
  const router    = useRouter();
  const websiteId = params?.websiteId as string;

  const [days,   setDays]   = useState(7);
  const [status, setStatus] = useState<Status>('unresolved');
  const [search, setSearch] = useState('');
  const [openFingerprint, setOpenFingerprint] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>('count');
  const [trend, setTrend] = useState<ErrorBucket | ''>('');
  const [kind, setKind] = useState('');
  const [layout, setLayout] = useLayoutPreference<ErrorLayout>('errors', LAYOUTS, 'list');

  // The API treats an empty status as "every status"; the tabs call that "All".
  const filters = { days, status: status === 'all' ? '' : status, search };

  const { data: groups, isLoading, error } = useErrorGroups(websiteId, filters);
  const detail    = useErrorGroup(websiteId, openFingerprint, days);
  const setStatusMutation = useSetErrorStatus(websiteId);
  const { canEdit } = usePermissions(websiteId);

  // Demo data is dated against a fixed clock; relative times read against it too.
  const now = isDemo(websiteId) ? DEMO_REFERENCE_DATE.getTime() : undefined;
  const rangeStart = (now ?? Date.now()) - days * 86_400_000;
  const periodLabel = days === 1 ? 'in the last 24 hours' : `in the last ${days} days`;
  const lineFor = (g: ErrorGroup) => errorLine(g, rangeStart, periodLabel);

  const list = useMemo(() => groups ?? [], [groups]);
  const kinds = [...new Set(list.map((g) => errorTypeOf(g.message)))].sort();
  const shown = useMemo(() => list
    .filter((g) => !trend || errorBucket(g, rangeStart) === trend)
    .filter((g) => !kind || errorTypeOf(g.message) === kind)
    .sort(SORTS[sort].compare), [list, trend, kind, sort, rangeStart]);

  const fields: FilterField[] = [
    {
      id: 'trend', label: 'Trend', value: trend, onChange: (v) => setTrend(v as ErrorBucket | ''),
      options: ERROR_BUCKETS.map((b) => ({ value: b.id, label: b.label, icon: <span aria-hidden className={cn('size-1.5 rounded-full', b.dot)} /> })),
    },
    { id: 'kind', label: 'Kind', value: kind, onChange: setKind, options: kinds.map((k) => ({ value: k, label: k })) },
  ];

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

  const props = { groups: shown, periodStart: rangeStart, lineFor, now, onOpen: setOpenFingerprint };
  const narrowed = !!(search.trim() || trend || kind);

  return (
    <div className={LIST_PAGE}>
      <PageBar
        icon={<Bug />}
        title="Errors"
        views={
          <ViewTabs
            label="Status"
            tabs={[{ id: 'unresolved', label: 'Unresolved' }, { id: 'resolved', label: 'Resolved' }, { id: 'ignored', label: 'Ignored' }, { id: 'all', label: 'All' }]}
            value={status}
            onChange={setStatus}
          />
        }
      >
        <RangeSelect value={days} onChange={setDays} ranges={RANGES} />
      </PageBar>

      <FilterToolbar
        sort={{ value: sort, onChange: (v) => setSort(v as Sort), options: (Object.keys(SORTS) as Sort[]).map((id) => ({ value: id, label: SORTS[id].label })) }}
        filters={fields}
        search={{ value: search, onChange: setSearch, placeholder: 'Search errors…', label: 'Search errors' }}
        count={groups ? `${shown.length} ${shown.length === 1 ? 'error' : 'errors'}` : undefined}
      >
        <LayoutSwitch layouts={LAYOUTS} value={layout} onChange={setLayout} />
      </FilterToolbar>

      {error && (
        <Alert variant="destructive" className="m-4 w-auto">
          <AlertDescription>{(error as Error).message}</AlertDescription>
        </Alert>
      )}

      {isLoading ? <CollectionSkeleton /> : shown.length === 0 ? (
        <CollectionEmpty
          icon={<Bug />}
          title={narrowed ? 'No matches' : status === 'unresolved' ? 'No unresolved errors' : 'No errors here'}
          description={narrowed
            ? 'No error matches these filters or that search in this range.'
            : `Nothing ${status === 'all' ? '' : `${status} `}${periodLabel}. Uncaught JavaScript errors from real visitors appear here, grouped by fault.`}
        />
      ) : layout === 'table' ? (
        <ErrorTable {...props} sortedBy={sort} />
      ) : (
        <ErrorList {...props} />
      )}
    </div>
  );
}
