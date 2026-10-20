'use client';

/** Every conversion sent, newest first: what it was, where it went, how it was matched, and how it went. */
import { useEffect, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { RotateCw, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  COLLECTION_SURFACE, CollectionEmpty, CollectionPager, CollectionSkeleton, CollectionTable, CountTabs, FilterToolbar,
  type CollectionColumn, type FilterField,
} from '@/components/ui/collection';
import { GHOST_BUTTON } from '@/components/ui/linear-list';
import { relativeTime } from '@/features/errors/format';
import { useRetryConversion, useRetryConversions } from '@/features/conversions/mutations';
import { conversionsApi } from '@/features/conversions/api';
import { conversionKeys, useConversionEvents } from '@/features/conversions/queries';
import type { ConversionEvent, ConversionStatus, Destination, EventKind, MatchKey } from '@/features/conversions/types';
import { cn } from '@/lib/utils';
import { useLocale, useT } from '@/lib/i18n';
import { formatValue, PLATFORMS } from './conversion-format';
import { EventDetailSheet } from './EventDetailSheet';
import { PlatformMark, StatusLabel } from './parts';

const PAGE_SIZE = 50;

const STATUSES: ConversionStatus[] = ['success', 'failed', 'pending', 'skipped'];

type MatchLevel = 'strong' | 'good' | 'weak';
const MATCH_DOT: Record<MatchLevel, string> = { strong: 'bg-emerald-500', good: 'bg-amber-500', weak: 'bg-rose-500' };
/** Strong: the ad click and the person (email or phone); good: either; weak: only the browser's hints. */
function matchLevel(keys: readonly MatchKey[]): MatchLevel {
  const click = keys.includes('click_id');
  const person = keys.includes('email') || keys.includes('phone');
  return click && person ? 'strong' : click || person ? 'good' : 'weak';
}

export function EventsTable({
  websiteId, destinations, now, canEdit, days,
}: {
  websiteId: string;
  destinations: Destination[];
  /** The header's date range: only events from the last this many days. */
  days: number;
  now?: number;
  canEdit: boolean;
}) {
  const all = useT();
  const t = all.conversions.events;
  const kinds = all.conversions.kinds;
  const { locale } = useLocale();
  const [page, setPage] = useState(0);
  /** The open tab: every platform, or one connected destination by id. */
  const [tab, setTab] = useState('all');
  const destination = tab === 'all' ? '' : tab;
  const [status, setStatus] = useState<ConversionStatus | ''>('');
  const [kind, setKind] = useState<EventKind | ''>('');
  /** An order ID or event name, as typed; the request follows it after a pause. */
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => { const timer = setTimeout(() => setQuery(search.trim()), 300); return () => clearTimeout(timer); }, [search]);
  const list = useConversionEvents(websiteId, { destination, status, kind, days, search: query, limit: PAGE_SIZE, offset: page * PAGE_SIZE });
  const retry = useRetryConversion(websiteId);
  const retryMany = useRetryConversions(websiteId);
  /** Events ticked in the table, by id. */
  const [selected, setSelected] = useState<Set<string>>(new Set());
  /** The event opened in the side sheet. */
  const [opened, setOpened] = useState<ConversionEvent | null>(null);
  const total = list.data?.total ?? 0;
  const events = list.data?.events ?? [];
  const narrowed = !!(destination || status || kind || query);
  /** The tabs: every platform, then each connected one. */
  const tabs = ['all', ...destinations.map((d) => d.id)];
  /** Each platform tab's count, under the same status and kind: one row per request, read for its total; the open tab's is the list's own. */
  const counts = useQueries({
    queries: tabs.map((id) => {
      const filters = { destination: id === 'all' ? '' : id, status, kind, days, search: query, limit: 1, offset: 0 };
      return {
        queryKey: conversionKeys.events(websiteId, filters),
        queryFn: () => conversionsApi.events(websiteId, filters),
        enabled: !!websiteId && id !== tab,
        staleTime: 30_000,
      };
    }),
  });
  const countOf = (id: string, i: number) => (id === tab ? list.data?.total : counts[i]?.data?.total);
  const tabLabel = (id: string) => {
    if (id === 'all') return all.conversions.page.tabs.all;
    const d = destinations.find((x) => x.id === id);
    return d ? d.name || PLATFORMS[d.platform].label : id;
  };

  // A narrower set changes what page 2 means.
  useEffect(() => { setPage(0); }, [destination, status, kind, days, query]);

  const filters: FilterField[] = [
    {
      // The platform is the tab; how each send went is a filter.
      id: 'status', label: all.actions.status, value: status, onChange: (v) => setStatus(v as ConversionStatus | ''),
      options: STATUSES.map((s) => ({ value: s, label: all.conversions.page.tabs[s] })),
    },
    {
      id: 'kind', label: t.event, value: kind, onChange: (v) => setKind(v as EventKind | ''),
      options: (Object.keys(kinds) as EventKind[]).map((k) => ({ value: k, label: kinds[k] })),
    },
  ];

  const columns: CollectionColumn<ConversionEvent>[] = [
    {
      // What happened, as people say it (a purchase and its order, a lead), over where it went and
      // the name that platform knows it by.
      id: 'event', header: t.event,
      cell: (e) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted"><PlatformMark platform={e.platform} className="h-4 w-4" /></span>
          <span className="block min-w-0">
            <span className="block truncate text-[13.5px] font-medium text-foreground">
              {e.kind === 'custom' ? <span className="font-mono text-[12.5px]">{e.event_name}</span> : kinds[e.kind]}
              {e.order_id && <span className="font-normal text-muted-foreground"> · <span className="font-mono text-[12.5px] text-foreground/80">#{e.order_id.replace(/^#/, '')}</span></span>}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {PLATFORMS[e.platform].label}
              {e.platform_event && e.status !== 'skipped' && <> · {t.sentAs} <span className="font-mono">{e.platform_event}</span></>}
            </span>
          </span>
        </span>
      ),
    },
    {
      // How surely the platform can tie it to the person: the strength, then the details it carried.
      id: 'match', header: t.matchedWith, width: '22%',
      cell: (e) => {
        // A skipped event never left: there was nothing for the platform to match.
        if (e.status === 'skipped') return <span className="text-xs text-muted-foreground">{t.nothingSent}</span>;
        if (e.match_keys.length === 0) return <span className="text-muted-foreground">—</span>;
        const level = matchLevel(e.match_keys);
        return (
          <span className="block min-w-0">
            <span className="inline-flex items-center gap-1.5 text-[13px] text-foreground">
              <span className={cn('size-1.5 shrink-0 rounded-full', MATCH_DOT[level])} aria-hidden />{t.matchLevel[level]}
            </span>
            <span className="block truncate text-xs text-muted-foreground" title={e.match_keys.map((k) => all.conversions.match[k]).join(', ')}>
              {e.match_keys.map((k) => all.conversions.match[k]).join(' · ')}
            </span>
          </span>
        );
      },
    },
    { id: 'value', header: t.value, width: '100px', align: 'right', cell: (e) => <span className={cn('tabular-nums', e.value === null ? 'text-muted-foreground' : 'font-medium text-foreground')}>{formatValue(e.value, e.currency)}</span> },
    {
      id: 'status', header: all.actions.status, width: '26%',
      cell: (e) => (
        <span className="block min-w-0">
          <span className="flex items-center gap-1.5">
            <StatusLabel status={e.status} />
            {e.attempt_count > 1 && <span className="text-xs text-muted-foreground">· {t.tries(e.attempt_count)}</span>}
          </span>
          {e.error && <span className={cn('block truncate text-xs', e.status === 'failed' ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground')} title={e.error}>{e.error}</span>}
        </span>
      ),
    },
    {
      id: 'when', header: t.when, width: '96px', align: 'right', sorted: true,
      cell: (e) => <time className="text-xs text-muted-foreground" dateTime={e.created_at} title={new Date(e.created_at).toLocaleString(locale === 'bn' ? 'bn-BD-u-nu-latn' : undefined)}>{relativeTime(e.created_at, now, all.errors.time)}</time>,
    },
    {
      id: 'actions', header: <span className="sr-only">{all.actions.actions}</span>, width: '100px', align: 'right',
      cell: (e) => (e.status === 'failed' && canEdit ? (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground"
          // Retries in place; the row's own click (opening the sheet) is not for this button.
          onClick={(ev) => { ev.stopPropagation(); retry.mutate(e.id, {
            onSuccess: () => toast.success(t.retryQueued),
            onError: () => toast.error(t.retryFailed),
          }); }}
        >
          <RotateCw className="h-3.5 w-3.5" />{all.actions.retry}
        </Button>
      ) : null),
    },
  ];

  /** The ticked events still on this page, and the failed ones among them: only those can be sent again. */
  const chosen = events.filter((e) => selected.has(e.id));
  const chosenFailed = chosen.filter((e) => e.status === 'failed');
  /** Under the toolbar while events are ticked: how many, clear, retry the failed ones. */
  const bulkBar = chosen.length > 0 && canEdit ? (
    <div className="flex items-center gap-2 border-b border-border/70 bg-muted/60 px-4 py-1.5 text-[13px]">
      <span className="font-medium text-foreground">{t.selected(chosen.length)}</span>
      <button type="button" className={GHOST_BUTTON} onClick={() => setSelected(new Set())}>{all.actions.clear}</button>
      <button
        type="button"
        className={GHOST_BUTTON}
        disabled={chosenFailed.length === 0 || retryMany.isPending}
        onClick={() => retryMany.mutate(chosenFailed.map((e) => e.id), {
          onSuccess: () => { toast.success(t.retriedMany(chosenFailed.length)); setSelected(new Set()); },
          onError: () => toast.error(t.retryFailed),
        })}
      >
        <RotateCw className="size-3.5" />{t.retryFailedSelected(chosenFailed.length)}
      </button>
    </div>
  ) : null;

  /** The table's top row: the platforms with their counts on the left, the filters on the right. */
  const toolbar = (
    <FilterToolbar
      leading={
        <CountTabs
          label={t.platform}
          tabs={tabs.map((id, i) => ({ id, label: tabLabel(id), count: countOf(id, i) }))}
          value={tab}
          onChange={(next) => { setTab(next); setPage(0); }}
        />
      }
      filters={filters}
      search={{ value: search, onChange: setSearch, placeholder: all.conversions.searchPlaceholder, label: all.conversions.searchPlaceholder }}
    />
  );

  return (
    <>
      {list.isLoading ? <div className={COLLECTION_SURFACE}>{toolbar}<CollectionSkeleton /></div> : events.length === 0 ? (
        <div className={COLLECTION_SURFACE}>{toolbar}<CollectionEmpty
          icon={<Send />}
          title={narrowed ? t.noMatches : t.empty}
          description={narrowed ? t.noMatchBody : t.emptyBody}
        /></div>
      ) : (
        <CollectionTable
          label={all.conversions.page.title} items={events} getKey={(e) => e.id} columns={columns} minWidth={940} rowClassName="h-14"
          onOpen={setOpened}
          toolbar={<>{toolbar}{bulkBar}</>}
          selection={canEdit ? {
            selected,
            labelOf: (id) => events.find((e) => e.id === id)?.event_name ?? id,
            onChange: (ids, on) => setSelected((prev) => { const next = new Set(prev); ids.forEach((id) => (on ? next.add(id) : next.delete(id))); return next; }),
          } : undefined}
        />
      )}
      <CollectionPager page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} previousLabel={t.newer} nextLabel={t.older} />
      <EventDetailSheet websiteId={websiteId} event={opened} destinations={destinations} now={now} canEdit={canEdit} onClose={() => setOpened(null)} />
    </>
  );
}
