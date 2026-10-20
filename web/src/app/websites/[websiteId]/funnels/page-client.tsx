'use client';

import { usePathSegment } from '@/lib/path-segment';

import { useEffect, useMemo, useState } from 'react';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePermissions } from '@/hooks/use-permissions';
import { AskAiButton } from '@/components/ai/AskAiButton';
import { askAbout } from '@/features/ai/ask-link';
import { GitBranch, Trash2, Plus } from 'lucide-react';
import {
  COLLECTION_SURFACE, CollectionEmpty, CollectionSkeleton, CountTabs, FilterToolbar, LayoutSwitch, useLayoutPreference, type FilterField,
} from '@/components/ui/collection';
import { GHOST_BUTTON, LIST_PAGE, PageBar } from '@/components/ui/linear-list';
import { FUNNEL_TONES, FunnelCards, FunnelList, FunnelTable } from '@/components/funnels/FunnelViews';
import { isDemo } from '@/lib/demo';
import { useCreateFunnel, useUpdateFunnel, useDeleteFunnel, useDeleteFunnels } from '@/features/funnels/mutations';
import { useFunnels, useFunnelsAnalytics, type Funnel } from '@/features/funnels/queries';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { FunnelBuilder } from '@/components/analytics/FunnelBuilder';
import { DEFAULT_FUNNEL_DAYS, FUNNEL_RANGES, FunnelRangeSelect, MAX_FUNNEL_DAYS } from '@/components/funnels/FunnelRangeSelect';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { FUNNEL_TONE_DOT, FUNNEL_TONE_RANK, funnelTone, previousFrom, type FunnelPrevious, type FunnelTone } from '@/features/funnels/insights';
import type { FunnelAnalyticsItem } from '@/lib/funnels-dashboard';

/** The demo's period before, so its trends read like a real site's. */
const DEMO_PREVIOUS: Record<string, FunnelPrevious> = {
  'demo-funnel-1': { starts: 81_200, conversions: 5_360 },
  'demo-funnel-2': { starts: 31_900, conversions: 3_250 },
};

type View = 'all' | 'attention';
type Sort = 'attention' | 'rate' | 'starts' | 'name';

const LAYOUTS = ['list', 'table', 'cards'] as const;
type FunnelLayout = (typeof LAYOUTS)[number];

const rateOf = (a?: FunnelAnalyticsItem) => (a && a.total_starts ? a.total_conversions / a.total_starts : -1);

export default function FunnelsPage() {
  const params = { websiteId: usePathSegment(1) ?? '' };
  const router = useRouter();
  const searchParams = useSearchParams();
  const websiteId = params?.websiteId as string;
  // Creating, editing and deleting funnels is for members and up; a viewer reads the reports.
  const { canEdit } = usePermissions(websiteId);
  const isDemoMode = isDemo(websiteId);

  const all = useT();
  const t = all.funnels.list;
  const [dateRange, setDateRange] = useState<number>(DEFAULT_FUNNEL_DAYS);
  const [confirm, confirmDialog] = useConfirm();
  const [search, setSearch] = useState('');
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingFunnel, setEditingFunnel] = useState<Funnel | null>(null);

  const { data: funnels = [], isLoading: funnelsLoading } = useFunnels(websiteId);

  // Named builder states are for the deterministic demo/content surfaces only.
  useEffect(() => {
    if (!isDemoMode) return;
    const contentState = searchParams.get('contentState');
    if (contentState === 'create') {
      setEditingFunnel(null);
      setIsBuilderOpen(true);
    }
    if (contentState === 'edit' && funnels[0]) {
      setEditingFunnel(funnels[0]);
      setIsBuilderOpen(true);
    }
  }, [funnels, isDemoMode, searchParams]);
  const funnelIds = useMemo(() => funnels.map(f => f.id), [funnels]);
  // From the same per-funnel reports the rows show. The list endpoint's `stats` are
  // zeroed placeholders (core funnel.repository.ts mapFunnel), so averaging them read
  // 0.0% on every site whatever the funnels converted at. A funnel nobody has entered
  // has no rate yet and is left out rather than counted as 0%.
  const funnelReports = useFunnelsAnalytics(funnelIds, dateRange, websiteId);
  // Twice the period: what is left after this period's counts is the period before, for the trend.
  // Only when the API can serve twice the period: past its cap the doubled report comes back
  // clamped to this one's range — the same heavy query again, and a trend that is always empty.
  const doubledReports = useFunnelsAnalytics(funnelIds, dateRange * 2, websiteId, dateRange * 2 <= MAX_FUNNEL_DAYS);
  const previousOf = (id: string): FunnelPrevious | null =>
    isDemoMode
      ? DEMO_PREVIOUS[id] ?? null
      : previousFrom(funnelReports.data?.[id]?.analytics?.[0], doubledReports.data?.[id]?.analytics?.[0]);
  const reportOf = (id: string) => funnelReports.data?.[id]?.analytics?.[0];
  const [view, setView] = useState<View>('all');
  const [sort, setSort] = useState<Sort>('attention');
  const [trend, setTrend] = useState<FunnelTone | ''>('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Table first: the funnels side by side, with checkboxes for acting on several at once.
  const [layout, setLayout] = useLayoutPreference<FunnelLayout>('funnels', LAYOUTS, 'table');
  const createFunnelMutation = useCreateFunnel();
  const updateFunnelMutation = useUpdateFunnel();
  const deleteFunnelMutation = useDeleteFunnel();
  const bulkDeleteMutation = useDeleteFunnels();

  const handleSaveFunnel = (data: Omit<Funnel, 'id' | 'website_id' | 'created_at' | 'updated_at'>) => {
    if (editingFunnel) {
      updateFunnelMutation.mutate(
        { websiteId, funnelId: editingFunnel.id, funnelData: data },
        {
          onSuccess: () => {
            setIsBuilderOpen(false);
            setEditingFunnel(null);
          },
        }
      );
    } else {
      createFunnelMutation.mutate(
        { websiteId, funnelData: data },
        {
          onSuccess: () => setIsBuilderOpen(false),
        }
      );
    }
  };

  const handleDeleteFunnel = async (id: string) => {
    const ok = await confirm({
      title: t.deleteTitle,
      description: t.deleteBody,
      confirmLabel: t.deleteConfirm,
      destructive: true,
    });
    if (ok) deleteFunnelMutation.mutate({ websiteId, funnelId: id });
  };

  const toneOf = (f: Funnel) => funnelTone(f, reportOf(f.id), previousOf(f.id));
  const SORTS: Record<Sort, { label: string; compare: (a: Funnel, b: Funnel) => number }> = {
    attention: { label: t.sortAttention, compare: (a, b) => FUNNEL_TONE_RANK[toneOf(b)] - FUNNEL_TONE_RANK[toneOf(a)] || (reportOf(b.id)?.total_starts ?? 0) - (reportOf(a.id)?.total_starts ?? 0) },
    rate: { label: t.sortRate, compare: (a, b) => rateOf(reportOf(b.id)) - rateOf(reportOf(a.id)) },
    starts: { label: t.sortStarts, compare: (a, b) => (reportOf(b.id)?.total_starts ?? 0) - (reportOf(a.id)?.total_starts ?? 0) },
    name: { label: t.sortName, compare: (a, b) => a.name.localeCompare(b.name) },
  };

  const q = search.trim().toLowerCase();
  /** The funnels the search and Trend filter keep, before the tab narrows them. */
  const matching = funnels
    .filter((f) => !trend || toneOf(f) === trend)
    .filter((f) => !q || f.name.toLowerCase().includes(q) || (f.description ?? '').toLowerCase().includes(q));
  const inView = (f: Funnel, v: View) => v === 'all' || ['worse', 'leak'].includes(toneOf(f));
  const shown = matching.filter((f) => inView(f, view)).sort(SORTS[sort].compare);

  const fields: FilterField[] = [{
    id: 'trend', label: t.trend, value: trend, onChange: (v) => setTrend(v as FunnelTone | ''),
    options: FUNNEL_TONES.map((tone) => ({ value: tone, label: all.funnels.tones[tone], icon: <span aria-hidden className={cn('size-1.5 rounded-full', FUNNEL_TONE_DOT[tone])} /> })),
  }];

  const open = (f: Funnel) => router.push(`/websites/${websiteId}/funnels/${f.id}`);
  const props = {
    funnels: shown, reportOf, previousOf, loading: funnelReports.isLoading, canEdit, onOpen: open,
    onEdit: (f: Funnel) => { setEditingFunnel(f); setIsBuilderOpen(true); },
    onDelete: (f: Funnel) => handleDeleteFunnel(f.id),
  };
  const chosen = [...selected].filter((id) => shown.some((f) => f.id === id));
  const narrowed = !!(q || trend || view !== 'all');

  const views: { id: View; label: string }[] = [{ id: 'all', label: t.allFunnels }, { id: 'attention', label: t.needsAttention }];
  /** The panel's top row: the views with their counts on the left, every control on the right. */
  const toolbar = (
    <FilterToolbar
      leading={
        <CountTabs
          label={t.views}
          tabs={views.map((v) => ({ ...v, count: funnelsLoading ? undefined : matching.filter((f) => inView(f, v.id)).length }))}
          value={view}
          onChange={setView}
        />
      }
      sort={{ value: sort, onChange: (v) => setSort(v as Sort), options: (Object.keys(SORTS) as Sort[]).map((id) => ({ value: id, label: SORTS[id].label })) }}
      filters={fields}
      search={{ value: search, onChange: setSearch, placeholder: t.searchPlaceholder, label: t.search }}
    >
      <LayoutSwitch layouts={LAYOUTS} value={layout} onChange={setLayout} />
    </FilterToolbar>
  );

  /** Under the toolbar while funnels are ticked: how many, clear, delete. */
  const bulkBar = chosen.length > 0 && layout === 'table' && canEdit ? (
    <div className="flex items-center gap-2 border-b border-border/70 bg-muted/60 px-4 py-1.5 text-[13px]">
      <span className="font-medium text-foreground">{t.selected(chosen.length)}</span>
      <button type="button" className={GHOST_BUTTON} onClick={() => setSelected(new Set())}>{all.actions.clear}</button>
      <button
        type="button"
        className={cn(GHOST_BUTTON, 'gap-1.5 text-destructive hover:text-destructive')}
        disabled={bulkDeleteMutation.isPending}
        onClick={async () => {
          const ok = await confirm({
            title: t.deleteManyTitle(chosen.length),
            description: t.deleteManyBody,
            confirmLabel: all.actions.delete,
            destructive: true,
          });
          if (ok) bulkDeleteMutation.mutate({ websiteId, funnelIds: chosen }, { onSuccess: () => setSelected(new Set()) });
        }}
      >
        <Trash2 className="size-3.5" />{all.actions.delete}
      </button>
    </div>
  ) : null;

  return (
    <div className={LIST_PAGE}>
      {confirmDialog}
      <PageBar title={t.title} description={t.description}>
        <AskAiButton websiteId={websiteId} {...askAbout.funnels(dateRange, all.ai.ask)} />
        <FunnelRangeSelect value={dateRange} onChange={setDateRange} />
        {canEdit && (
          <Button onClick={() => { setEditingFunnel(null); setIsBuilderOpen(true); }} className="h-7 gap-1.5 px-2.5 text-[12.5px]">
            <Plus className="size-3.5" /> {t.newFunnel}
          </Button>
        )}
      </PageBar>

      {funnelsLoading ? <div className={COLLECTION_SURFACE}>{toolbar}<CollectionSkeleton /></div> : shown.length === 0 ? (
        <div className={COLLECTION_SURFACE}>{toolbar}<CollectionEmpty
          icon={<GitBranch />}
          title={narrowed ? t.noMatches : t.empty}
          description={narrowed ? t.noMatchesBody : t.emptyBody}
          action={!narrowed && canEdit ? <Button size="sm" className="gap-1.5" onClick={() => { setEditingFunnel(null); setIsBuilderOpen(true); }}><Plus className="h-3.5 w-3.5" />{t.newFunnel}</Button> : undefined}
        /></div>
      ) : layout === 'table' ? (
        <FunnelTable
          {...props}
          toolbar={<>{toolbar}{bulkBar}</>}
          sortedBy={sort}
          selection={canEdit ? {
            selected,
            labelOf: (id) => funnels.find((f) => f.id === id)?.name ?? id,
            onChange: (ids, on) => setSelected((prev) => { const next = new Set(prev); ids.forEach((id) => (on ? next.add(id) : next.delete(id))); return next; }),
          } : undefined}
        />
      ) : layout === 'cards' ? (
        <FunnelCards {...props} toolbar={toolbar} />
      ) : (
        <FunnelList {...props} toolbar={toolbar} />
      )}

      {/* Create/Edit Funnel Sheet */}
      <Sheet
        open={isBuilderOpen}
        onOpenChange={(open) => {
          setIsBuilderOpen(open);
          if (!open) setEditingFunnel(null);
        }}
      >
        <SheetContent>
          <FunnelBuilder
            key={editingFunnel?.id ?? 'new'}
            websiteId={websiteId}
            existingFunnel={editingFunnel || undefined}
            onSave={handleSaveFunnel}
            onCancel={() => {
              setIsBuilderOpen(false);
              setEditingFunnel(null);
            }}
          />
        </SheetContent>
      </Sheet>
    </div>
  );
}
