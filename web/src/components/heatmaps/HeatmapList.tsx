'use client';

import type { ReactNode } from 'react';
import { FileText, House, Trash2 } from 'lucide-react';
import {
  CARD, CardGrid, CollectionRow, CollectionTable, GroupedRows,
  type CollectionColumn, type CollectionGroup, type RowSelection,
} from '@/components/ui/collection';
import { DOT, DotLabel, DoneIcon, HalfIcon, PendingIcon, type DotTone } from '@/components/ui/linear-list';
import { HeatmapThumbnail, type ThumbMode } from '@/components/heatmaps/HeatmapThumbnail';
import {
  heatmapLine, heatmapTone, pageName, pageSignals,
  type HeatmapGroupId, type HeatmapPageFacts,
} from '@/features/heatmaps/page-insights';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';

export interface HeatmapListPage extends HeatmapPageFacts {
  /** The stored path, for requests. */
  url: string;
  /** The path as shown, shortened; `title` is the full one. */
  path: string;
  title: string;
  active: boolean;
  clicks: number;
  last_seen?: string;
}

export type HeatmapDevice = 'desktop' | 'mobile';

export const HEATMAP_SIGNAL: Record<HeatmapGroupId, { label: string; tone: DotTone }> = {
  dead_clicks: { label: 'Dead clicks', tone: 'orange' },
  low_scroll: { label: 'Leave early', tone: 'violet' },
  mobile_gap: { label: 'Worse on mobile', tone: 'indigo' },
  too_little: { label: 'Not enough data', tone: 'grey' },
  healthy: { label: 'Healthy', tone: 'green' },
};

const groupsFor = (t: { groupProblem: string; groupHealthy: string; groupUnknown: string }): CollectionGroup[] => [
  { id: 'problem', label: t.groupProblem, icon: <HalfIcon /> },
  { id: 'healthy', label: t.groupHealthy, icon: <DoneIcon /> },
  { id: 'unknown', label: t.groupUnknown, icon: <PendingIcon /> },
];

/** What every layout is told: the pages, which device's scroll to show, and what to do. */
interface LayoutProps {
  pages: HeatmapListPage[];
  device: HeatmapDevice;
  onOpen: (url: string) => void;
  /** Absent when the viewer cannot delete. */
  onDelete?: (url: string) => void;
  /** The panel's top row: the view tabs and the list's controls. */
  toolbar?: ReactNode;
}

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const key = (p: HeatmapListPage) => p.url;
const scrollOf = (p: HeatmapListPage, device: HeatmapDevice) => (device === 'mobile' ? p.mobile_avg_scroll : p.desktop_avg_scroll);
const deadTone = (dead: number | null | undefined) => (dead != null && dead >= 20 ? 'text-orange-600 dark:text-[#f2994a]' : 'text-foreground/75');

/** Every signal the page has, most pressing first. */
function Signal({ page }: { page: HeatmapListPage }) {
  const t = useT().heatmaps.signals;
  return (
    <span className="flex flex-wrap gap-1">
      {pageSignals(page).map((id) => <DotLabel key={id} label={t[id]} dot={DOT[HEATMAP_SIGNAL[id].tone]} />)}
    </span>
  );
}

/** The page's name as a button: the keyboard's way into a row or card that opens on click. */
function PageName({ page, onOpen, className }: { page: HeatmapListPage; onOpen: (url: string) => void; className?: string }) {
  const t = useT().heatmaps.rows;
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onOpen(page.url); }}
      aria-label={t.open(page.path)}
      className={cn('shrink-0 text-left text-foreground focus-visible:underline focus-visible:outline-none', className)}
    >
      {pageName(page.title, t.home)}
    </button>
  );
}

function ScrollBar({ value }: { value: number | null | undefined }) {
  return (
    <span className="flex items-center justify-end gap-2">
      {value != null && (
        <span aria-hidden className="h-1 w-14 overflow-hidden rounded-full bg-border">
          <span className="block h-1 rounded-full bg-foreground/60" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
        </span>
      )}
      <span className="w-8 text-right text-[12.5px] tabular-nums text-foreground/75">{value == null ? '—' : `${Math.round(value)}%`}</span>
    </span>
  );
}

function DeleteButton({ page, onDelete, className }: { page: HeatmapListPage; onDelete: (url: string) => void; className?: string }) {
  const t = useT().heatmaps.rows;
  return (
    <button
      type="button"
      title={t.deleteTitle}
      aria-label={t.deleteLabel(page.path)}
      onClick={(e) => { e.stopPropagation(); onDelete(page.url); }}
      className={cn('flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100', className)}
    >
      <Trash2 className="size-3" />
    </button>
  );
}

// ── List ─────────────────────────────────────────────────────────────────────

/** The columns the list's header and rows share, so they line up. */
const COL = {
  signal: 'hidden w-[132px] shrink-0 md:block',
  views: 'w-16 shrink-0 text-right',
  dead: 'hidden w-20 shrink-0 text-right sm:block',
  scroll: 'w-[116px] shrink-0',
};

/**
 * Grouped Needs attention / Healthy / Not enough data, each page a name, its path and one
 * line on what visitors do, then three columns.
 */
export function HeatmapList({ pages, device, onOpen, onDelete, toolbar }: LayoutProps) {
  const m = useT().heatmaps;
  const t = m.rows;
  return (
    <GroupedRows
      toolbar={toolbar}
      header={
        <div aria-hidden className="flex h-[34px] items-center gap-3 border-b border-border pl-[34px] pr-4 text-xs text-muted-foreground">
          <span className="w-3.5 shrink-0" />
          <span className="flex-1">{t.colPage}</span>
          <span className={COL.signal}>{t.colSignal}</span>
          <span className={COL.views}>{t.colViews}</span>
          <span className={COL.dead}>{t.colDead}</span>
          <span className={cn(COL.scroll, 'text-right')}>{t.colScroll(device === 'mobile')}</span>
          {onDelete && <span className="w-6 shrink-0" />}
        </div>
      }
      items={pages}
      getKey={key}
      groups={groupsFor(t)}
      groupOf={(p) => heatmapTone(p)}
      renderRow={(p) => (
        <CollectionRow onOpen={() => onOpen(p.url)} className={cn('min-h-[52px]', !p.active && 'opacity-60')}>
          <FileText aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex min-w-0 items-baseline gap-2">
              <PageName page={p} onOpen={onOpen} />
              <span className="truncate font-mono text-[11.5px] text-muted-foreground" title={p.title}>{p.path}</span>
            </span>
            <span className="truncate text-xs text-muted-foreground">{heatmapLine(p, m.line)}</span>
          </span>
          <span className={COL.signal}><Signal page={p} /></span>
          <span className={cn(COL.views, 'text-[12.5px] tabular-nums text-foreground/75')}>{compact.format(p.views)}</span>
          <span className={cn(COL.dead, 'text-[12.5px] tabular-nums', deadTone(p.dead_click_pct))}>{p.dead_click_pct == null ? '—' : `${p.dead_click_pct}%`}</span>
          <span className={COL.scroll}><ScrollBar value={scrollOf(p, device)} /></span>
          {onDelete && <DeleteButton page={p} onDelete={onDelete} />}
        </CollectionRow>
      )}
    />
  );
}

// ── Table ────────────────────────────────────────────────────────────────────

/** Every figure side by side, for comparing pages. */
export function HeatmapTable({ pages, device, onOpen, onDelete, sortedBy, toolbar, selection }: LayoutProps & { sortedBy: 'attention' | 'views' | 'dead'; selection?: RowSelection }) {
  const t = useT().heatmaps.rows;
  const columns: CollectionColumn<HeatmapListPage>[] = [
    {
      id: 'page', header: t.colPage,
      cell: (p) => (
        // A page icon (a house for the home page), then the name over its path.
        <span className="flex min-w-0 items-center gap-2.5">
          <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground [&_svg]:size-3.5">
            {p.path === '/' ? <House /> : <FileText />}
          </span>
          <span className="flex min-w-0 flex-col leading-tight">
            <PageName page={p} onOpen={onOpen} className="truncate font-medium" />
            <span className="truncate font-mono text-[11.5px] text-muted-foreground" title={p.title}>{p.path}</span>
          </span>
        </span>
      ),
    },
    { id: 'signal', header: t.colSignal, width: '300px', sorted: sortedBy === 'attention', cell: (p) => <Signal page={p} /> },
    { id: 'views', header: t.colViews, width: '84px', align: 'right', sorted: sortedBy === 'views', cell: (p) => <span className="tabular-nums text-foreground/75">{compact.format(p.views)}</span> },
    { id: 'scroll', header: t.colScroll(device === 'mobile'), width: '140px', align: 'right', cell: (p) => <ScrollBar value={scrollOf(p, device)} /> },
    ...(onDelete ? [{
      id: 'actions', header: <span className="sr-only">{t.colActions}</span>, width: '52px', align: 'right' as const,
      cell: (p: HeatmapListPage) => <DeleteButton page={p} onDelete={onDelete} className="ml-auto" />,
    }] : []),
  ];
  return <CollectionTable label={t.tableLabel} items={pages} getKey={key} columns={columns} onOpen={(p) => onOpen(p.url)} minWidth={640} toolbar={toolbar} selection={selection} rowClassName="h-14" />;
}

// ── Cards ────────────────────────────────────────────────────────────────────

/** Each page itself with this period's heat on it: clicks over the top, or scroll down it. */
export function HeatmapCards({
  pages, device, onOpen, onDelete, websiteId, days, demo, mode, toolbar,
}: LayoutProps & { websiteId: string; days: number; demo: boolean; mode: ThumbMode }) {
  const m = useT().heatmaps;
  const t = m.rows;
  return (
    <CardGrid
      toolbar={toolbar}
      items={pages}
      getKey={key}
      minCardWidth={290}
      renderCard={(p) => (
        <div onClick={() => onOpen(p.url)} className={cn(CARD, 'group relative cursor-pointer gap-0 overflow-hidden p-0')}>
          <div className={cn('border-b border-border', !p.active && 'opacity-60')}>
            <HeatmapThumbnail websiteId={websiteId} url={p.url} days={days} mode={mode} device={device} demo={demo} demoReach={p.reach_half_pct} />
          </div>
          <div className="flex flex-1 flex-col gap-2 p-3">
            <span className="flex min-w-0 items-baseline gap-2">
              <PageName page={p} onOpen={onOpen} className="text-[13px] font-medium" />
              <span className="truncate font-mono text-[11px] text-muted-foreground" title={p.title}>{p.path}</span>
              <span className="ml-auto shrink-0"><Signal page={p} /></span>
            </span>
            <span className="line-clamp-2 min-h-[2.4em] text-[12.5px] leading-snug text-muted-foreground">{heatmapLine(p, m.line)}</span>
            <span className="flex gap-4 text-xs text-muted-foreground">
              <span><span className="tabular-nums text-foreground">{compact.format(p.views)}</span> {t.views}</span>
              <span><span className={cn('tabular-nums', deadTone(p.dead_click_pct))}>{p.dead_click_pct == null ? '—' : `${p.dead_click_pct}%`}</span> {t.dead}</span>
              <span><span className="tabular-nums text-foreground">{scrollOf(p, device) == null ? '—' : `${Math.round(scrollOf(p, device)!)}%`}</span> {t.avgScroll}</span>
            </span>
          </div>
          {onDelete && <DeleteButton page={p} onDelete={onDelete} className="absolute right-2 top-2 size-7 bg-card/90 shadow-sm" />}
        </div>
      )}
    />
  );
}
