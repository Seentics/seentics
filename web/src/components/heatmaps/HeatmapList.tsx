'use client';

import { FileText, Trash2 } from 'lucide-react';
import {
  CARD, CardGrid, CollectionRow, CollectionTable, GroupedRows,
  type CollectionColumn, type CollectionGroup,
} from '@/components/ui/collection';
import { DOT, DotLabel, DoneIcon, HalfIcon, PendingIcon, type DotTone } from '@/components/ui/linear-list';
import { HeatmapThumbnail, type ThumbMode } from '@/components/heatmaps/HeatmapThumbnail';
import {
  heatmapLine, heatmapTone, pageName, pageStatus,
  type HeatmapGroupId, type HeatmapPageFacts,
} from '@/features/heatmaps/page-insights';
import { cn } from '@/lib/utils';

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

const GROUPS: CollectionGroup[] = [
  { id: 'problem', label: 'Needs attention', icon: <HalfIcon /> },
  { id: 'healthy', label: 'Healthy', icon: <DoneIcon /> },
  { id: 'unknown', label: 'Not enough data', icon: <PendingIcon /> },
];

/** What every layout is told: the pages, which device's scroll to show, and what to do. */
interface LayoutProps {
  pages: HeatmapListPage[];
  device: HeatmapDevice;
  onOpen: (url: string) => void;
  /** Absent when the viewer cannot delete. */
  onDelete?: (url: string) => void;
}

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const key = (p: HeatmapListPage) => p.url;
const scrollOf = (p: HeatmapListPage, device: HeatmapDevice) => (device === 'mobile' ? p.mobile_avg_scroll : p.desktop_avg_scroll);
const deadTone = (dead: number | null | undefined) => (dead != null && dead >= 20 ? 'text-orange-600 dark:text-[#f2994a]' : 'text-foreground/75');

function Signal({ page }: { page: HeatmapListPage }) {
  const s = HEATMAP_SIGNAL[pageStatus(page)];
  return <DotLabel label={s.label} dot={DOT[s.tone]} />;
}

/** The page's name as a button: the keyboard's way into a row or card that opens on click. */
function PageName({ page, onOpen, className }: { page: HeatmapListPage; onOpen: (url: string) => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onOpen(page.url); }}
      aria-label={`Open heatmap for ${page.path}`}
      className={cn('shrink-0 text-left text-foreground focus-visible:underline focus-visible:outline-none', className)}
    >
      {pageName(page.title)}
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
  return (
    <button
      type="button"
      title="Delete data for this page"
      aria-label={`Delete heatmap data for ${page.path}`}
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
export function HeatmapList({ pages, device, onOpen, onDelete }: LayoutProps) {
  return (
    <>
      <div aria-hidden className="flex h-[34px] items-center gap-3 border-b border-border pl-[34px] pr-4 text-xs text-muted-foreground">
        <span className="w-3.5 shrink-0" />
        <span className="flex-1">Page</span>
        <span className={COL.signal}>Signal</span>
        <span className={COL.views}>Views</span>
        <span className={COL.dead}>Dead clicks</span>
        <span className={cn(COL.scroll, 'text-right')}>Avg scroll{device === 'mobile' ? ' · mobile' : ''}</span>
        {onDelete && <span className="w-6 shrink-0" />}
      </div>
      <GroupedRows
        items={pages}
        getKey={key}
        groups={GROUPS}
        groupOf={(p) => heatmapTone(p)}
        renderRow={(p) => (
          <CollectionRow onOpen={() => onOpen(p.url)} className={cn('min-h-[52px]', !p.active && 'opacity-60')}>
            <FileText aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex min-w-0 items-baseline gap-2">
                <PageName page={p} onOpen={onOpen} />
                <span className="truncate font-mono text-[11.5px] text-muted-foreground" title={p.title}>{p.path}</span>
              </span>
              <span className="truncate text-xs text-muted-foreground">{heatmapLine(p)}</span>
            </span>
            <span className={COL.signal}><Signal page={p} /></span>
            <span className={cn(COL.views, 'text-[12.5px] tabular-nums text-foreground/75')}>{compact.format(p.views)}</span>
            <span className={cn(COL.dead, 'text-[12.5px] tabular-nums', deadTone(p.dead_click_pct))}>{p.dead_click_pct == null ? '—' : `${p.dead_click_pct}%`}</span>
            <span className={COL.scroll}><ScrollBar value={scrollOf(p, device)} /></span>
            {onDelete && <DeleteButton page={p} onDelete={onDelete} />}
          </CollectionRow>
        )}
      />
    </>
  );
}

// ── Table ────────────────────────────────────────────────────────────────────

/** Every figure side by side, for comparing pages. */
export function HeatmapTable({ pages, device, onOpen, onDelete, sortedBy }: LayoutProps & { sortedBy: 'attention' | 'views' | 'dead' }) {
  const columns: CollectionColumn<HeatmapListPage>[] = [
    {
      id: 'page', header: 'Page', width: '28%',
      cell: (p) => (
        <span className="flex min-w-0 items-baseline gap-2">
          <PageName page={p} onOpen={onOpen} />
          <span className="truncate font-mono text-[11.5px] text-muted-foreground" title={p.title}>{p.path}</span>
        </span>
      ),
    },
    { id: 'signal', header: 'Signal', width: '150px', sorted: sortedBy === 'attention', cell: (p) => <Signal page={p} /> },
    { id: 'views', header: 'Views', width: '84px', align: 'right', sorted: sortedBy === 'views', cell: (p) => <span className="tabular-nums text-foreground/75">{compact.format(p.views)}</span> },
    { id: 'clicks', header: 'Clicks', width: '84px', align: 'right', cell: (p) => <span className="tabular-nums text-foreground/75">{compact.format(p.clicks)}</span> },
    {
      id: 'dead', header: 'Dead clicks', width: '100px', align: 'right', sorted: sortedBy === 'dead',
      cell: (p) => <span className={cn('tabular-nums', deadTone(p.dead_click_pct))}>{p.dead_click_pct == null ? '—' : `${p.dead_click_pct}%`}</span>,
    },
    { id: 'reach', header: 'Past halfway', width: '110px', align: 'right', cell: (p) => <span className="tabular-nums text-foreground/75">{p.reach_half_pct == null ? '—' : `${p.reach_half_pct}%`}</span> },
    { id: 'scroll', header: `Avg scroll${device === 'mobile' ? ' · mobile' : ''}`, width: '140px', align: 'right', cell: (p) => <ScrollBar value={scrollOf(p, device)} /> },
    {
      id: 'gap', header: 'Mobile vs desktop', width: '130px', align: 'right',
      cell: (p) => {
        if (p.mobile_avg_scroll == null || p.desktop_avg_scroll == null) return <span className="text-muted-foreground">—</span>;
        const gap = Math.round(p.desktop_avg_scroll - p.mobile_avg_scroll);
        return <span className={cn('tabular-nums', gap >= 20 ? 'text-orange-600 dark:text-[#f2994a]' : 'text-foreground/75')}>{gap > 0 ? `−${gap}` : `+${-gap}`} pts</span>;
      },
    },
    ...(onDelete ? [{
      id: 'actions', header: <span className="sr-only">Actions</span>, width: '52px', align: 'right' as const,
      cell: (p: HeatmapListPage) => <DeleteButton page={p} onDelete={onDelete} className="ml-auto" />,
    }] : []),
  ];
  return <CollectionTable label="Pages" items={pages} getKey={key} columns={columns} onOpen={(p) => onOpen(p.url)} minWidth={1060} />;
}

// ── Cards ────────────────────────────────────────────────────────────────────

/** Each page itself with this period's heat on it: clicks over the top, or scroll down it. */
export function HeatmapCards({
  pages, device, onOpen, onDelete, websiteId, days, demo, mode,
}: LayoutProps & { websiteId: string; days: number; demo: boolean; mode: ThumbMode }) {
  return (
    <CardGrid
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
            <span className="line-clamp-2 min-h-[2.4em] text-[12.5px] leading-snug text-muted-foreground">{heatmapLine(p)}</span>
            <span className="flex gap-4 text-xs text-muted-foreground">
              <span><span className="tabular-nums text-foreground">{compact.format(p.views)}</span> views</span>
              <span><span className={cn('tabular-nums', deadTone(p.dead_click_pct))}>{p.dead_click_pct == null ? '—' : `${p.dead_click_pct}%`}</span> dead</span>
              <span><span className="tabular-nums text-foreground">{scrollOf(p, device) == null ? '—' : `${Math.round(scrollOf(p, device)!)}%`}</span> avg scroll</span>
            </span>
          </div>
          {onDelete && <DeleteButton page={p} onDelete={onDelete} className="absolute right-2 top-2 size-7 bg-card/90 shadow-sm" />}
        </div>
      )}
    />
  );
}
