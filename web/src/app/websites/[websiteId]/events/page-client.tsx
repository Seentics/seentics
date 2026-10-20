'use client';

import { usePathSegment } from '@/lib/path-segment';

import { useMemo, useState } from 'react';
import { ChevronRight, MousePointerClick } from 'lucide-react';
import { useCustomEvents } from '@/features/analytics/queries';
import {
  CollectionEmpty, CollectionRow, CollectionSkeleton, CollectionTable, FilterToolbar, GroupedRows,
  LayoutSwitch, useLayoutPreference, type CollectionColumn, type FilterField,
} from '@/components/ui/collection';
import { LIST_PAGE, PageBar } from '@/components/ui/linear-list';
import { RangeSelect } from '@/components/ui/range-select';
import { cn } from '@/lib/utils';

/** One custom event type over the period, as the analytics API returns it. */
type EventSummary = {
  event_type: string;
  count?: number;
  unique_visitors?: number;
  /** Older cores sent this name; `unique_visitors` alone showed 0 for every event on them. */
  unique_users?: number;
  top_properties?: Record<string, Record<string, number>>;
};

type Sort = 'count' | 'visitors' | 'name';

const LAYOUTS = ['list', 'table'] as const;
type EventLayout = (typeof LAYOUTS)[number];

const RANGES = [
  { days: 7, label: 'Last 7 days' },
  { days: 14, label: 'Last 14 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
] as const;

/**
 * What the tracker records on its own. `performance` (web vitals, sent on every page) and
 * `identify` (an identify() call, not a tracked event) used to be listed — and counted in
 * the totals — as if the site had tracked them.
 */
const INTERNAL = new Set(['pageview', 'session_start', 'session_end', '__sn_heartbeat', '__sn_leave', 'performance', 'identify']);

const countOf = (e: EventSummary) => e.count ?? 0;
const visitorsOf = (e: EventSummary) => e.unique_visitors ?? e.unique_users ?? 0;
const propsOf = (e: EventSummary) => Object.keys(e.top_properties ?? {});

const SORTS: Record<Sort, { label: string; compare: (a: EventSummary, b: EventSummary) => number }> = {
  count: { label: 'Most occurrences', compare: (a, b) => countOf(b) - countOf(a) },
  visitors: { label: 'Most visitors', compare: (a, b) => visitorsOf(b) - visitorsOf(a) },
  name: { label: 'Name', compare: (a, b) => a.event_type.localeCompare(b.event_type) },
};

/**
 * Every custom event sent with `seentics.track()` in the period: how often, by how many
 * visitors, and — opening a row — the values its properties took.
 */
export default function EventsPage() {
  const websiteId = usePathSegment(1) ?? '';
  const [days, setDays] = useState(7);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<Sort>('count');
  const [withProps, setWithProps] = useState('');
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [layout, setLayout] = useLayoutPreference<EventLayout>('events', LAYOUTS, 'list');

  const { data, isLoading } = useCustomEvents(websiteId, days);
  const events = useMemo(
    () => ((data?.top_events ?? []) as EventSummary[]).filter((e) => !INTERNAL.has(e.event_type)),
    [data],
  );

  const q = search.trim().toLowerCase();
  const shown = events
    .filter((e) => !withProps || (withProps === 'yes') === propsOf(e).length > 0)
    .filter((e) => !q || e.event_type.toLowerCase().includes(q) || propsOf(e).some((p) => p.toLowerCase().includes(q)))
    .sort(SORTS[sort].compare);
  const busiest = Math.max(1, ...shown.map(countOf));

  const fields: FilterField[] = [{
    id: 'props', label: 'Properties', op: '', value: withProps, onChange: setWithProps,
    options: [{ value: 'yes', label: 'Has properties' }, { value: 'no', label: 'No properties' }],
  }];

  const toggle = (name: string) => setOpen((prev) => {
    const next = new Set(prev);
    if (next.has(name)) next.delete(name); else next.add(name);
    return next;
  });

  const columns: CollectionColumn<EventSummary>[] = [
    { id: 'name', header: 'Event', width: '26%', sorted: sort === 'name', cell: (e) => <span className="font-mono text-[12.5px] text-foreground">{e.event_type}</span> },
    { id: 'count', header: 'Occurrences', width: '120px', align: 'right', sorted: sort === 'count', cell: (e) => <span className="tabular-nums text-foreground/80">{countOf(e).toLocaleString()}</span> },
    { id: 'visitors', header: 'Visitors', width: '110px', align: 'right', sorted: sort === 'visitors', cell: (e) => <span className="tabular-nums text-foreground/80">{visitorsOf(e).toLocaleString()}</span> },
    {
      id: 'per', header: 'Per visitor', width: '110px', align: 'right',
      cell: (e) => <span className="tabular-nums text-foreground/80">{visitorsOf(e) ? (countOf(e) / visitorsOf(e)).toFixed(1) : '—'}</span>,
    },
    {
      id: 'props', header: 'Properties',
      cell: (e) => (propsOf(e).length
        ? <span className="font-mono text-[11.5px] text-muted-foreground" title={propsOf(e).join(', ')}>{propsOf(e).join(', ')}</span>
        : <span className="text-muted-foreground">—</span>),
    },
  ];

  return (
    <div className={LIST_PAGE}>
      <PageBar icon={<MousePointerClick />} title="Custom events">
        <RangeSelect value={days} onChange={setDays} ranges={RANGES} />
      </PageBar>

      <FilterToolbar
        sort={{ value: sort, onChange: (v) => setSort(v as Sort), options: (Object.keys(SORTS) as Sort[]).map((id) => ({ value: id, label: SORTS[id].label })) }}
        filters={fields}
        search={{ value: search, onChange: setSearch, placeholder: 'Search events or properties…', label: 'Search events' }}
        count={data ? `${shown.length} ${shown.length === 1 ? 'event' : 'events'} · ${shown.reduce((s, e) => s + countOf(e), 0).toLocaleString()} times` : undefined}
      >
        <LayoutSwitch layouts={LAYOUTS} value={layout} onChange={setLayout} />
      </FilterToolbar>

      {isLoading ? <CollectionSkeleton /> : shown.length === 0 ? (
        <CollectionEmpty
          icon={<MousePointerClick />}
          title={events.length ? 'No matches' : 'No custom events yet'}
          description={events.length
            ? 'No event matches that filter or search in this range.'
            : <>Call <code className="rounded bg-muted px-1 font-mono">seentics.track(&apos;event_name&apos;)</code> from your site to start tracking.</>}
        />
      ) : layout === 'table' ? (
        <CollectionTable label="Custom events" items={shown} getKey={(e) => e.event_type} columns={columns} minWidth={860} />
      ) : (
        <GroupedRows
          items={shown}
          getKey={(e) => e.event_type}
          renderRow={(e) => {
            const props = Object.entries(e.top_properties ?? {});
            const isOpen = open.has(e.event_type);
            return (
              <>
                <CollectionRow onOpen={props.length ? () => toggle(e.event_type) : undefined}>
                  <span className="flex w-3.5 shrink-0 justify-center">
                    {props.length > 0 && <ChevronRight aria-hidden className={cn('size-3 text-muted-foreground transition-transform', isOpen && 'rotate-90')} />}
                  </span>
                  {props.length > 0 ? (
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={(ev) => { ev.stopPropagation(); toggle(e.event_type); }}
                      className="min-w-0 flex-1 truncate text-left font-mono text-[12.5px] text-foreground focus-visible:underline focus-visible:outline-none"
                    >
                      {e.event_type}
                    </button>
                  ) : (
                    <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-foreground">{e.event_type}</span>
                  )}
                  <span className="hidden truncate text-xs text-muted-foreground md:block md:w-48">{props.length ? `${props.length} propert${props.length === 1 ? 'y' : 'ies'}` : ''}</span>
                  <span className="w-28 shrink-0">
                    <span className="block text-right text-[12.5px] tabular-nums text-foreground">{countOf(e).toLocaleString()}</span>
                    <span aria-hidden className="mt-1 block h-1 overflow-hidden rounded-full bg-border">
                      <span className="block h-1 rounded-full bg-primary/60" style={{ width: `${Math.max(3, Math.round((countOf(e) / busiest) * 100))}%` }} />
                    </span>
                  </span>
                  <span className="w-24 shrink-0 text-right text-xs text-muted-foreground"><span className="tabular-nums text-foreground/80">{visitorsOf(e).toLocaleString()}</span> visitors</span>
                </CollectionRow>
                {isOpen && (
                  <div className="space-y-2.5 border-b border-border/60 bg-muted/30 py-3 pl-[60px] pr-4">
                    {props.slice(0, 10).map(([name, values]) => (
                      <div key={name} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-xs">
                        <span className="w-32 shrink-0 font-mono text-foreground">{name}</span>
                        {Object.entries(values ?? {}).slice(0, 8).map(([value, n]) => (
                          <span key={value} className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-1.5 py-0.5 text-foreground/80">
                            {value}<span className="tabular-nums text-muted-foreground">{Number(n).toLocaleString()}</span>
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
              </>
            );
          }}
        />
      )}
    </div>
  );
}
