'use client';

import { usePathSegment } from '@/lib/path-segment';

import { useMemo, useState } from 'react';
import { ChevronRight, MousePointerClick } from 'lucide-react';
import { useCustomEvents } from '@/features/analytics/queries';
// What the tracker records on its own, shared with the overview's events list.
import { isInternalEvent } from '@/features/analytics/internal-events';
import {
  COLLECTION_SURFACE, CollectionEmpty, CollectionRow, CollectionSkeleton, CollectionTable, CountTabs, FilterToolbar, GroupedRows,
  LayoutSwitch, useLayoutPreference, type CollectionColumn,
} from '@/components/ui/collection';
import { LIST_PAGE, PageBar } from '@/components/ui/linear-list';
import { RangeSelect } from '@/components/ui/range-select';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';

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
/** The views: every event, or those that do or do not carry properties. */
type View = 'all' | 'yes' | 'no';
const VIEWS: View[] = ['all', 'yes', 'no'];

const LAYOUTS = ['list', 'table'] as const;
type EventLayout = (typeof LAYOUTS)[number];

/** Range names are in `analytics.events.ranges`, keyed by days. */
const RANGE_DAYS = [7, 14, 30, 90] as const;


const countOf = (e: EventSummary) => e.count ?? 0;
const visitorsOf = (e: EventSummary) => e.unique_visitors ?? e.unique_users ?? 0;
const propsOf = (e: EventSummary) => Object.keys(e.top_properties ?? {});

/** Sort names are in `analytics.events.sorts`, keyed by id. */
const SORTS: Record<Sort, { compare: (a: EventSummary, b: EventSummary) => number }> = {
  count: { compare: (a, b) => countOf(b) - countOf(a) },
  visitors: { compare: (a, b) => visitorsOf(b) - visitorsOf(a) },
  name: { compare: (a, b) => a.event_type.localeCompare(b.event_type) },
};

/**
 * Every custom event sent with `seentics.track()` in the period: how often, by how many
 * visitors, and — opening a row — the values its properties took.
 */
export default function EventsPage() {
  const websiteId = usePathSegment(1) ?? '';
  const t = useT().analytics.events;
  const ranges = RANGE_DAYS.map((d) => ({ days: d, label: t.ranges[d] }));
  const [days, setDays] = useState(7);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<Sort>('count');
  const [view, setView] = useState<View>('all');
  const [open, setOpen] = useState<Set<string>>(new Set());
  // Table first: every event side by side, its properties under its name.
  const [layout, setLayout] = useLayoutPreference<EventLayout>('events', LAYOUTS, 'table');

  const { data, isLoading } = useCustomEvents(websiteId, days);
  const events = useMemo(
    () => ((data?.top_events ?? []) as EventSummary[]).filter((e) => !isInternalEvent(e.event_type)),
    [data],
  );

  const q = search.trim().toLowerCase();
  /** The events the search keeps, before the tab narrows them. */
  const matching = events.filter((e) => !q || e.event_type.toLowerCase().includes(q) || propsOf(e).some((p) => p.toLowerCase().includes(q)));
  const inView = (e: EventSummary, v: View) => v === 'all' || (v === 'yes') === propsOf(e).length > 0;
  const shown = matching.filter((e) => inView(e, view)).sort(SORTS[sort].compare);
  const busiest = Math.max(1, ...shown.map(countOf));

  const toggle = (name: string) => setOpen((prev) => {
    const next = new Set(prev);
    if (next.has(name)) next.delete(name); else next.add(name);
    return next;
  });

  // What decides which event to look at: how often it fires and for how many visitors. Its
  // properties sit under the name; the per-visitor rate follows from the two counts.
  const columns: CollectionColumn<EventSummary>[] = [
    {
      id: 'name', header: t.event, sorted: sort === 'name',
      cell: (e) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground [&_svg]:size-3.5"><MousePointerClick /></span>
          <span className="flex min-w-0 flex-col leading-tight">
            <span className="truncate font-mono text-[12.5px] font-medium text-foreground">{e.event_type}</span>
            <span className="truncate font-mono text-[11.5px] text-muted-foreground" title={propsOf(e).join(', ')}>{propsOf(e).length ? propsOf(e).join(', ') : '—'}</span>
          </span>
        </span>
      ),
    },
    { id: 'count', header: t.occurrences, width: '130px', align: 'right', sorted: sort === 'count', cell: (e) => <span className="tabular-nums text-foreground/80">{countOf(e).toLocaleString()}</span> },
    { id: 'visitors', header: t.visitors, width: '120px', align: 'right', sorted: sort === 'visitors', cell: (e) => <span className="tabular-nums text-foreground/80">{visitorsOf(e).toLocaleString()}</span> },
  ];

  const viewLabel: Record<View, string> = { all: t.allEvents, yes: t.hasProperties, no: t.noProperties };
  /** The panel's top row: the views with their counts on the left, every control on the right. */
  const toolbar = (
    <FilterToolbar
      leading={
        <CountTabs
          label={t.views}
          tabs={VIEWS.map((v) => ({ id: v, label: viewLabel[v], count: data ? matching.filter((e) => inView(e, v)).length : undefined }))}
          value={view}
          onChange={setView}
        />
      }
      sort={{ value: sort, onChange: (v) => setSort(v as Sort), options: (Object.keys(SORTS) as Sort[]).map((id) => ({ value: id, label: t.sorts[id] })) }}
      search={{ value: search, onChange: setSearch, placeholder: t.searchPlaceholder, label: t.searchLabel }}
    >
      <LayoutSwitch layouts={LAYOUTS} value={layout} onChange={setLayout} />
    </FilterToolbar>
  );

  return (
    <div className={LIST_PAGE}>
      <PageBar title={t.title} description={t.description}>
        <RangeSelect value={days} onChange={setDays} ranges={ranges} />
      </PageBar>

      {isLoading ? <div className={COLLECTION_SURFACE}>{toolbar}<CollectionSkeleton /></div> : shown.length === 0 ? (
        <div className={COLLECTION_SURFACE}>{toolbar}<CollectionEmpty
          icon={<MousePointerClick />}
          title={events.length ? t.noMatches : t.noEvents}
          description={events.length
            ? t.noMatchesBody
            : <>{t.emptyBefore}<code className="rounded bg-muted px-1 font-mono">seentics.track(&apos;event_name&apos;)</code>{t.emptyAfter}</>}
        /></div>
      ) : layout === 'table' ? (
        <CollectionTable label={t.title} items={shown} getKey={(e) => e.event_type} columns={columns} minWidth={600} rowClassName="h-14" toolbar={toolbar} />
      ) : (
        <GroupedRows
          toolbar={toolbar}
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
                  <span className="hidden truncate text-xs text-muted-foreground md:block md:w-48">{props.length ? t.propertyCount(props.length) : ''}</span>
                  <span className="w-28 shrink-0">
                    <span className="block text-right text-[12.5px] tabular-nums text-foreground">{countOf(e).toLocaleString()}</span>
                    <span aria-hidden className="mt-1 block h-1 overflow-hidden rounded-full bg-border">
                      <span className="block h-1 rounded-full bg-primary/60" style={{ width: `${Math.max(3, Math.round((countOf(e) / busiest) * 100))}%` }} />
                    </span>
                  </span>
                  <span className="w-24 shrink-0 text-right text-xs text-muted-foreground"><span className="tabular-nums text-foreground/80">{visitorsOf(e).toLocaleString()}</span> {t.visitorsSuffix}</span>
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
