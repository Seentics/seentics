'use client';

import { usePathSegment } from '@/lib/path-segment';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/hooks/use-permissions';
import { Button } from '@/components/ui/button';
import { RangeSelect } from '@/components/ui/range-select';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Bug, Check, ChevronLeft, EyeOff } from 'lucide-react';
import {
  COLLECTION_SURFACE, CollectionEmpty, CollectionSkeleton, CountTabs, FilterToolbar, LayoutSwitch, useLayoutPreference, type FilterField,
} from '@/components/ui/collection';
import { GHOST_BUTTON, LIST_PAGE, PageBar } from '@/components/ui/linear-list';
import { ErrorGroupDetail } from '@/components/errors/error-group-detail';
import { ErrorList, ErrorTable } from '@/components/errors/ErrorViews';
import { errorTypeOf } from '@/features/errors/format';
import { useErrorGroup, useErrorGroups } from '@/features/errors/queries';
import { useSetErrorStatus, useSetErrorStatuses } from '@/features/errors/mutations';
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
  { days: 1,  id: 'day' },
  { days: 7,  id: 'week' },
  { days: 30, id: 'month' },
] as const;

type Status = 'unresolved' | 'resolved' | 'ignored' | 'all';
const STATUSES: Status[] = ['unresolved', 'resolved', 'ignored', 'all'];
type Sort = 'count' | 'visitors' | 'recent' | 'new';

const LAYOUTS = ['list', 'table'] as const;
type ErrorLayout = (typeof LAYOUTS)[number];

const SORTS: Record<Sort, { compare: (a: ErrorGroup, b: ErrorGroup) => number }> = {
  count: { compare: (a, b) => (b.window?.count ?? b.event_count) - (a.window?.count ?? a.event_count) },
  visitors: { compare: (a, b) => (b.window?.sessions ?? 0) - (a.window?.sessions ?? 0) },
  recent: { compare: (a, b) => b.last_seen.localeCompare(a.last_seen) },
  new: { compare: (a, b) => b.first_seen.localeCompare(a.first_seen) },
};

export default function ErrorsPage() {
  const params = { websiteId: usePathSegment(1) ?? '' };
  const router    = useRouter();
  const all = useT();
  const t = all.errors;
  const websiteId = params?.websiteId as string;

  const [days,   setDays]   = useState(7);
  const [status, setStatus] = useState<Status>('unresolved');
  const [search, setSearch] = useState('');
  const [openFingerprint, setOpenFingerprint] = useState<string | null>(null);
  const [sort, setSort] = useState<Sort>('count');
  const [trend, setTrend] = useState<ErrorBucket | ''>('');
  const [kind, setKind] = useState('');
  // Table first: the errors side by side, with checkboxes for resolving or ignoring several at once.
  const [layout, setLayout] = useLayoutPreference<ErrorLayout>('errors', LAYOUTS, 'table');
  /** Errors ticked in the table, by fingerprint. */
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // The API treats an empty status as "every status"; the tabs call that "All".
  const filters = { days, status: status === 'all' ? '' : status, search };

  const { data: groups, isLoading, error } = useErrorGroups(websiteId, filters);
  // Every status at once, for the tabs' counts; the same request as the list when All is open.
  const { data: everyStatus } = useErrorGroups(websiteId, { ...filters, status: '' });
  const detail    = useErrorGroup(websiteId, openFingerprint, days);
  const setStatusMutation = useSetErrorStatus(websiteId);
  const bulkStatus = useSetErrorStatuses(websiteId);
  const { canEdit } = usePermissions(websiteId);

  // Demo data is dated against a fixed clock; relative times read against it too.
  const now = isDemo(websiteId) ? DEMO_REFERENCE_DATE.getTime() : undefined;
  const rangeStart = (now ?? Date.now()) - days * 86_400_000;
  const periodLabel = t.period(days);
  const lineFor = (g: ErrorGroup) => errorLine(g, rangeStart, periodLabel, t.line);
  const ranges = RANGES.map((r) => ({ days: r.days, label: t.ranges[r.id] }));

  const list = useMemo(() => groups ?? [], [groups]);
  const kinds = [...new Set(list.map((g) => errorTypeOf(g.message)))].sort();
  const shown = useMemo(() => list
    .filter((g) => !trend || errorBucket(g, rangeStart) === trend)
    .filter((g) => !kind || errorTypeOf(g.message) === kind)
    .sort(SORTS[sort].compare), [list, trend, kind, sort, rangeStart]);
  /** Each tab's count: the same search, trend and kind, by status. */
  const countFor = (s: Status): number | undefined => {
    if (!everyStatus) return undefined;
    const kept = everyStatus
      .filter((g) => !trend || errorBucket(g, rangeStart) === trend)
      .filter((g) => !kind || errorTypeOf(g.message) === kind);
    return s === 'all' ? kept.length : kept.filter((g) => g.status === s).length;
  };

  const fields: FilterField[] = [
    {
      id: 'trend', label: t.page.trend, value: trend, onChange: (v) => setTrend(v as ErrorBucket | ''),
      options: ERROR_BUCKETS.map((b) => ({ value: b.id, label: t.buckets[b.id], icon: <span aria-hidden className={cn('size-1.5 rounded-full', b.dot)} /> })),
    },
    { id: 'kind', label: t.page.kind, value: kind, onChange: setKind, options: kinds.map((k) => ({ value: k, label: k })) },
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
          <ChevronLeft className="h-4 w-4" /> {t.page.allErrors}
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

  const narrowed = !!(search.trim() || trend || kind);
  /** The panel's top row: the statuses with their counts on the left, every control on the right. */
  const toolbar = (
    <FilterToolbar
      leading={
        <CountTabs
          label={t.page.statusLabel}
          tabs={STATUSES.map((s) => ({ id: s, label: t.tabs[s], count: countFor(s) }))}
          value={status}
          onChange={setStatus}
        />
      }
      sort={{ value: sort, onChange: (v) => setSort(v as Sort), options: (Object.keys(SORTS) as Sort[]).map((id) => ({ value: id, label: t.sorts[id] })) }}
      filters={fields}
      search={{ value: search, onChange: setSearch, placeholder: t.page.searchPlaceholder, label: t.page.searchLabel }}
    >
      <LayoutSwitch layouts={LAYOUTS} value={layout} onChange={setLayout} />
    </FilterToolbar>
  );
  const props = { groups: shown, periodStart: rangeStart, lineFor, now, onOpen: setOpenFingerprint, toolbar };
  /** The ticked errors still shown: a tab, filter or search that hides one leaves it out. */
  const chosen = [...selected].filter((fp) => shown.some((g) => g.fingerprint === fp));
  const setChosen = (next: 'resolved' | 'ignored') =>
    bulkStatus.mutate({ fingerprints: chosen, status: next }, { onSuccess: () => setSelected(new Set()) });
  /** Under the toolbar while errors are ticked: how many, clear, resolve, ignore. */
  const bulkBar = chosen.length > 0 && layout === 'table' && canEdit ? (
    <div className="flex items-center gap-2 border-b border-border/70 bg-muted/60 px-4 py-1.5 text-[13px]">
      <span className="font-medium text-foreground">{t.page.selected(chosen.length)}</span>
      <button type="button" className={GHOST_BUTTON} onClick={() => setSelected(new Set())}>{all.actions.clear}</button>
      <button type="button" className={GHOST_BUTTON} disabled={bulkStatus.isPending} onClick={() => setChosen('resolved')}>
        <Check className="size-3.5" />{t.detail.resolve}
      </button>
      <button type="button" className={GHOST_BUTTON} disabled={bulkStatus.isPending} onClick={() => setChosen('ignored')}>
        <EyeOff className="size-3.5" />{t.detail.ignore}
      </button>
    </div>
  ) : null;

  return (
    <div className={LIST_PAGE}>
      <PageBar title={t.page.title} description={t.page.description}>
        <RangeSelect value={days} onChange={setDays} ranges={ranges} />
      </PageBar>

      {error && (
        <Alert variant="destructive" className="m-4 w-auto">
          <AlertDescription>{(error as Error).message}</AlertDescription>
        </Alert>
      )}

      {isLoading ? <div className={COLLECTION_SURFACE}>{toolbar}<CollectionSkeleton /></div> : shown.length === 0 ? (
        <div className={COLLECTION_SURFACE}>{toolbar}<CollectionEmpty
          icon={<Bug />}
          title={narrowed ? t.page.noMatches : status === 'unresolved' ? t.page.noUnresolved : t.page.noErrors}
          description={narrowed
            ? t.page.noMatchesBody
            : t.page.emptyBody(status === 'all' ? '' : status, periodLabel)}
        /></div>
      ) : layout === 'table' ? (
        <ErrorTable
          {...props}
          sortedBy={sort}
          toolbar={<>{toolbar}{bulkBar}</>}
          selection={canEdit ? {
            selected,
            labelOf: (fp) => shown.find((g) => g.fingerprint === fp)?.message ?? fp,
            onChange: (fps, on) => setSelected((prev) => { const next = new Set(prev); fps.forEach((fp) => (on ? next.add(fp) : next.delete(fp))); return next; }),
          } : undefined}
        />
      ) : (
        <ErrorList {...props} />
      )}
    </div>
  );
}
