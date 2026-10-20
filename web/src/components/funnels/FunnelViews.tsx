'use client';

import { Edit, GitBranch, MoreVertical, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  CARD, CardGrid, CollectionRow, CollectionTable, GroupedRows,
  type CollectionColumn, type CollectionGroup, type RowSelection,
} from '@/components/ui/collection';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { biggestLeak, FUNNEL_TONE_DOT, funnelLine, funnelTone, type FunnelPrevious, type FunnelTone } from '@/features/funnels/insights';
import type { Funnel } from '@/features/funnels/queries';
import type { FunnelAnalyticsItem } from '@/lib/funnels-dashboard';
import { cn } from '@/lib/utils';

export const FUNNEL_TONE_LABEL: Record<FunnelTone, string> = {
  worse: 'Getting worse', leak: 'Big leak', better: 'Improving', steady: 'Steady', quiet: 'Quiet or paused',
};
const ORDER: FunnelTone[] = ['worse', 'leak', 'better', 'steady', 'quiet'];
const GROUPS: CollectionGroup[] = ORDER.map((id) => ({
  id, label: FUNNEL_TONE_LABEL[id], icon: <span aria-hidden className={cn('size-2 rounded-full', FUNNEL_TONE_DOT[id])} />,
}));

export interface FunnelLayoutProps {
  funnels: Funnel[];
  reportOf: (id: string) => FunnelAnalyticsItem | undefined;
  previousOf: (id: string) => FunnelPrevious | null;
  /** The reports are still loading: rows show placeholders where their figures go. */
  loading: boolean;
  canEdit: boolean;
  onOpen: (f: Funnel) => void;
  onEdit: (f: Funnel) => void;
  onDelete: (f: Funnel) => void;
}

const key = (f: Funnel) => f.id;
const pct = (n: number) => `${n >= 10 ? Math.round(n) : n.toFixed(1)}%`;
const rateOf = (a?: FunnelAnalyticsItem) => (a && a.total_starts ? (a.total_conversions / a.total_starts) * 100 : null);

function Name({ funnel: f, onOpen, className }: { funnel: Funnel; onOpen: (f: Funnel) => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onOpen(f); }}
      title={f.description || undefined}
      className={cn('min-w-0 truncate text-left text-[13px] text-foreground focus-visible:underline focus-visible:outline-none', className)}
    >
      {f.name}
    </button>
  );
}

function Menu({ funnel: f, canEdit, onEdit, onDelete }: Pick<FunnelLayoutProps, 'canEdit' | 'onEdit' | 'onDelete'> & { funnel: Funnel }) {
  if (!canEdit) return null;
  return (
    <span onClick={(e) => e.stopPropagation()} className="shrink-0">
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-7 text-muted-foreground" aria-label={`Options for ${f.name}`}>
            <MoreVertical className="size-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-36">
          <DropdownMenuItem onClick={() => onEdit(f)}><Edit size={12} className="mr-2" /> Edit funnel</DropdownMenuItem>
          <DropdownMenuItem onClick={() => onDelete(f)} className="font-medium text-destructive"><Trash2 size={12} className="mr-2" /> Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </span>
  );
}

/**
 * Each step as a bar, as tall as the share of entrants who reached it, the biggest drop
 * marked in orange. With no report yet, the steps are drawn flat.
 */
export function StepBars({ funnel: f, report: a, className }: { funnel: Funnel; report?: FunnelAnalyticsItem; className?: string }) {
  const steps = f.steps ?? [];
  const metrics = a?.step_metrics ?? [];
  const first = metrics.find((m) => m.step === 1)?.count || a?.total_starts || 0;
  const leak = a ? biggestLeak(f, a) : null;
  const leakStep = leak ? steps.findIndex((s) => s.name === leak.to) + 1 : -1;
  return (
    <span aria-hidden className={cn('flex items-end gap-1', className)}>
      {steps.map((s, i) => {
        const count = metrics.find((m) => m.step === i + 1)?.count ?? 0;
        const h = first ? Math.max(6, Math.round((count / first) * 100)) : 30;
        return (
          <span key={i} className="flex h-full flex-1 items-end" title={s.name}>
            <span className={cn('w-full rounded-sm', i + 1 === leakStep ? 'bg-orange-500/70' : 'bg-primary/60')} style={{ height: `${h}%` }} />
          </span>
        );
      })}
    </span>
  );
}

function Rate({ report, loading }: { report?: FunnelAnalyticsItem; loading: boolean }) {
  if (loading) return <Skeleton className="ml-auto h-4 w-12" />;
  const r = rateOf(report);
  return <span className="tabular-nums text-foreground">{r == null ? '—' : pct(r)}</span>;
}

// ── List ─────────────────────────────────────────────────────────────────────

/** Grouped by how each is doing: getting worse, a big leak, improving, steady, quiet. */
export function FunnelList({ funnels, reportOf, previousOf, loading, canEdit, onOpen, onEdit, onDelete }: FunnelLayoutProps) {
  return (
    <GroupedRows
      items={funnels}
      getKey={key}
      groups={loading ? undefined : GROUPS}
      groupOf={(f) => funnelTone(f, reportOf(f.id), previousOf(f.id))}
      renderRow={(f) => (
        <CollectionRow onOpen={() => onOpen(f)} className="min-h-[52px]">
          <GitBranch aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex min-w-0 items-baseline gap-2">
              <Name funnel={f} onOpen={onOpen} />
              <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{f.steps?.length ?? 0} steps</span>
            </span>
            {loading ? <Skeleton className="h-3 w-56" /> : (
              <span className="truncate text-xs text-muted-foreground">{funnelLine(f, reportOf(f.id), previousOf(f.id), false)}</span>
            )}
          </span>
          <StepBars funnel={f} report={reportOf(f.id)} className="hidden h-6 w-28 shrink-0 md:flex" />
          <span className="w-16 shrink-0 text-right text-[13px]"><Rate report={reportOf(f.id)} loading={loading} /></span>
          <Menu funnel={f} canEdit={canEdit} onEdit={onEdit} onDelete={onDelete} />
        </CollectionRow>
      )}
    />
  );
}

// ── Table ────────────────────────────────────────────────────────────────────

export function FunnelTable({ funnels, reportOf, previousOf, loading, canEdit, onOpen, onEdit, onDelete, selection, sortedBy }: FunnelLayoutProps & { selection?: RowSelection; sortedBy: string }) {
  const columns: CollectionColumn<Funnel>[] = [
    {
      id: 'name', header: 'Funnel', width: '24%', sorted: sortedBy === 'name',
      cell: (f) => (
        <span className="flex min-w-0 items-center gap-2">
          <span aria-hidden className={cn('size-2 shrink-0 rounded-full', FUNNEL_TONE_DOT[funnelTone(f, reportOf(f.id), previousOf(f.id))])} />
          <Name funnel={f} onOpen={onOpen} />
        </span>
      ),
    },
    { id: 'steps', header: 'Steps', width: '70px', align: 'right', cell: (f) => <span className="tabular-nums text-foreground/80">{f.steps?.length ?? 0}</span> },
    { id: 'starts', header: 'Entered', width: '100px', align: 'right', sorted: sortedBy === 'starts', cell: (f) => <span className="tabular-nums text-foreground/80">{reportOf(f.id)?.total_starts?.toLocaleString() ?? '—'}</span> },
    { id: 'conv', header: 'Converted', width: '100px', align: 'right', cell: (f) => <span className="tabular-nums text-foreground/80">{reportOf(f.id)?.total_conversions?.toLocaleString() ?? '—'}</span> },
    { id: 'rate', header: 'Rate', width: '80px', align: 'right', sorted: sortedBy === 'rate', cell: (f) => <Rate report={reportOf(f.id)} loading={loading} /> },
    {
      id: 'leak', header: 'Biggest drop',
      cell: (f) => {
        const a = reportOf(f.id);
        const leak = a ? biggestLeak(f, a) : null;
        return leak ? <span className="text-foreground/80" title={`${leak.from} → ${leak.to}`}>{leak.from} → {leak.to} <span className="text-muted-foreground">({pct(leak.rate)})</span></span> : <span className="text-muted-foreground">—</span>;
      },
    },
    { id: 'trend', header: 'Trend', width: '140px', sorted: sortedBy === 'attention', cell: (f) => <span className="text-foreground/80">{FUNNEL_TONE_LABEL[funnelTone(f, reportOf(f.id), previousOf(f.id))]}</span> },
    { id: 'shape', header: 'Shape', width: '120px', cell: (f) => <StepBars funnel={f} report={reportOf(f.id)} className="h-5 w-24" /> },
    ...(canEdit ? [{ id: 'menu', header: <span className="sr-only">Options</span>, width: '52px', align: 'right' as const, cell: (f: Funnel) => <span className="flex justify-end"><Menu funnel={f} canEdit={canEdit} onEdit={onEdit} onDelete={onDelete} /></span> }] : []),
  ];
  return <CollectionTable label="Funnels" items={funnels} getKey={key} columns={columns} onOpen={onOpen} selection={selection} minWidth={1100} />;
}

// ── Cards ────────────────────────────────────────────────────────────────────

/** The funnel's shape at a glance: a bar per step, the rate, and what stands out. */
export function FunnelCards({ funnels, reportOf, previousOf, loading, canEdit, onOpen, onEdit, onDelete }: FunnelLayoutProps) {
  return (
    <CardGrid
      items={funnels}
      getKey={key}
      minCardWidth={300}
      renderCard={(f) => {
        const a = reportOf(f.id);
        const tone = funnelTone(f, a, previousOf(f.id));
        const steps = f.steps ?? [];
        return (
          <div onClick={() => onOpen(f)} className={cn(CARD, 'cursor-pointer gap-3')}>
            <span className="flex min-w-0 items-center gap-2">
              <span aria-hidden className={cn('size-2 shrink-0 rounded-full', FUNNEL_TONE_DOT[tone])} title={FUNNEL_TONE_LABEL[tone]} />
              <Name funnel={f} onOpen={onOpen} className="font-medium" />
              <span className="ml-auto flex items-center gap-1 text-lg font-semibold tracking-tight"><Rate report={a} loading={loading} /></span>
              <Menu funnel={f} canEdit={canEdit} onEdit={onEdit} onDelete={onDelete} />
            </span>
            <StepBars funnel={f} report={a} className={cn('h-20 w-full', !f.is_active && 'opacity-50')} />
            <span className="flex gap-1 text-[10.5px] text-muted-foreground">
              {steps.map((s, i) => <span key={i} className="flex-1 truncate" title={s.name}>{s.name}</span>)}
            </span>
            {loading ? <Skeleton className="h-3 w-3/4" /> : (
              <span className="line-clamp-2 min-h-[2.4em] text-[12.5px] leading-snug text-muted-foreground">{funnelLine(f, a, previousOf(f.id), false)}</span>
            )}
            <span className="flex gap-4 border-t border-border/60 pt-2 text-xs text-muted-foreground">
              <span><span className="tabular-nums text-foreground">{a?.total_starts?.toLocaleString() ?? '—'}</span> entered</span>
              <span><span className="tabular-nums text-foreground">{a?.total_conversions?.toLocaleString() ?? '—'}</span> converted</span>
            </span>
          </div>
        );
      }}
    />
  );
}
