'use client';

import { usePathSegment } from '@/lib/path-segment';

import { useEffect, useMemo, useState } from 'react';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useRouter, useSearchParams } from 'next/navigation';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { usePermissions } from '@/hooks/use-permissions';
import { AskAiButton } from '@/components/ai/AskAiButton';
import { askAbout } from '@/features/ai/ask-link';
import { StatCards } from '@/components/seentics-ui/StatCards';
import { GitBranch, MoreVertical, Eye, Edit, Trash2, Plus, Search } from 'lucide-react';
import { isDemo } from '@/lib/demo';
import { useCreateFunnel, useUpdateFunnel, useDeleteFunnel, useDeleteFunnels } from '@/features/funnels/mutations';
import { useFunnels, useFunnelsAnalytics, type Funnel } from '@/features/funnels/queries';
import { DataTable, SortableHeader, selectionColumn } from '@/components/ui/data-table';

import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { FunnelBuilder } from '@/components/analytics/FunnelBuilder';
import { DEFAULT_FUNNEL_DAYS, FUNNEL_RANGES, FunnelRangeSelect, MAX_FUNNEL_DAYS } from '@/components/funnels/FunnelRangeSelect';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ListGroups } from '@/components/ui/list-groups';
import { FUNNEL_GROUP_META, FUNNEL_TONE_DOT, FUNNEL_TONE_RANK, funnelLine, funnelTone, inFunnelGroup, previousFrom, type FunnelGroupId, type FunnelPrevious } from '@/features/funnels/insights';

/** The demo's period before, so its trends read like a real site's. */
const DEMO_PREVIOUS: Record<string, FunnelPrevious> = {
  'demo-funnel-1': { starts: 81_200, conversions: 5_360 },
  'demo-funnel-2': { starts: 31_900, conversions: 3_250 },
};


export default function FunnelsPage() {
  const params = { websiteId: usePathSegment(1) ?? '' };
  const router = useRouter();
  const searchParams = useSearchParams();
  const websiteId = params?.websiteId as string;
  // Creating, editing and deleting funnels is for members and up; a viewer reads the reports.
  const { canEdit } = usePermissions(websiteId);
  const isDemoMode = isDemo(websiteId);

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
  /** A group the table is narrowed to, from "Show all" below it. */
  const [groupFilter, setGroupFilter] = useState<FunnelGroupId | null>(null);
  const avgConversionStr = useMemo(() => {
    if (isDemoMode || funnelIds.length === 0) return '';
    const rates = Object.values(funnelReports.data ?? {})
      .map(r => r.analytics?.[0])
      .filter(item => item && (item.total_starts ?? 0) > 0)
      .map(item => Number(item!.conversion_rate ?? 0))
      .filter(r => !Number.isNaN(r));
    if (!rates.length) return '—';
    const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
    return `${avg.toFixed(1)}%`;
  }, [isDemoMode, funnelIds.length, funnelReports.data]);
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
      title: 'Delete this funnel?',
      description: 'The funnel and its conversion history are removed. Your analytics data is not affected.',
      confirmLabel: 'Delete funnel',
      destructive: true,
    });
    if (ok) deleteFunnelMutation.mutate({ websiteId, funnelId: id });
  };

  const filtered = useMemo(() => {
    if (!search) return funnels;
    const s = search.toLowerCase();
    return funnels.filter(f =>
      f.name.toLowerCase().includes(s) ||
      (f.description ?? '').toLowerCase().includes(s)
    );
  }, [funnels, search]);

  const columns = useMemo(() => [
    ...(canEdit ? [selectionColumn<Funnel>()] : []),
    {
      id: 'name',
      header: ({ column }: { column: any }) => <SortableHeader column={column}>Funnel</SortableHeader>,
      accessorKey: 'name',
      cell: ({ row }: { row: any }) => (
        <div className="min-w-0 max-w-[min(100%,40rem)]">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <GitBranch size={14} />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-[13px] font-semibold text-foreground">{row.original.name}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                  {row.original.steps?.length || 0} steps
                </span>
              </div>
              {row.original.description ? (
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{row.original.description}</p>
              ) : null}
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'what',
      header: 'What happened',
      accessorFn: (f: Funnel) => FUNNEL_TONE_RANK[funnelTone(f, reportOf(f.id), previousOf(f.id))],
      size: 560,
      cell: ({ row }: { row: any }) => {
        const f = row.original as Funnel;
        const tone = funnelTone(f, reportOf(f.id), previousOf(f.id));
        const text = funnelLine(f, reportOf(f.id), previousOf(f.id));
        return funnelReports.isLoading ? (
          <Skeleton className="h-4 w-64" />
        ) : (
          <div className="flex min-w-0 max-w-[44rem] items-center gap-2">
            <span className={cn('h-2 w-2 shrink-0 rounded-full', FUNNEL_TONE_DOT[tone])} />
            <span className={cn('truncate text-sm', tone === 'worse' || tone === 'leak' ? 'text-foreground' : 'text-muted-foreground')} title={text}>
              {text}
            </span>
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      size: 150,
      cell: ({ row }: { row: any }) => (
        <div className="flex items-center justify-end gap-1 pr-0.5" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 bg-primary/10 px-3 text-xs font-semibold text-primary hover:bg-primary/15 hover:text-primary"
            onClick={(e) => { e.stopPropagation(); router.push(`/websites/${websiteId}/funnels/${row.original.id}`); }}
          >
            <Eye size={13} /> View
          </Button>
          {canEdit && <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                <MoreVertical size={14} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem onClick={() => { setEditingFunnel(row.original); setIsBuilderOpen(true); }}>
                <Edit size={12} className="mr-2" /> Edit funnel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDeleteFunnel(row.original.id)} className="text-destructive font-medium">
                <Trash2 size={12} className="mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>}
        </div>
      )
    }
  ], [websiteId, dateRange, router, funnelReports.data, funnelReports.isLoading, doubledReports.data, isDemoMode, canEdit]);


  // Summary Metrics
  const summary = useMemo(() => {
    if (isDemoMode) {
      return [
        { label: 'Active funnels', value: 3 },
        { label: 'Avg completion', value: '24.3%' },
        { label: 'Total entries', value: '48,291' },
        { label: 'Conversions', value: '11,726' },
      ];
    }
    return [
      { label: 'Active funnels', value: funnels.filter(f => f.is_active).length },
      { label: 'Total funnels', value: funnels.length },
      { label: 'Total steps', value: funnels.reduce((s, f) => s + (f.steps?.length || 0), 0) },
      {
        label: 'Avg. conversion',
        value: funnelIds.length === 0 ? '—' : avgConversionStr,
      },
    ];
  }, [isDemoMode, funnels, funnelIds.length, avgConversionStr]);

  return (
    <div className="w-full max-w-[1440px] mx-auto p-4 md:p-5 lg:px-6 lg:py-5">
      {confirmDialog}
      <DashboardPageHeader
        websiteId={websiteId}
        title="Funnels"
        description="Track conversion steps and identify where users drop off in their journey."
      >
        <AskAiButton websiteId={websiteId} size="md" {...askAbout.funnels(dateRange)} />
        <FunnelRangeSelect value={dateRange} onChange={setDateRange} />
        {canEdit && <Button
          onClick={() => { setEditingFunnel(null); setIsBuilderOpen(true); }}
          size="sm"
          className="gap-1.5"
        >
          <Plus size={14} /> New Funnel
        </Button>}
      </DashboardPageHeader>

      <StatCards cards={summary} isLoading={funnelsLoading} />

      <div className="mt-4">
        <DataTable
          className="shadow-sm rounded-lg overflow-hidden [&_tbody_tr]:transition-colors [&_td]:!py-2 [&_th]:!py-2"
          rowClassName={() => 'cursor-pointer hover:bg-muted/35'}
          onRowClick={(f) => router.push(`/websites/${websiteId}/funnels/${f.id}`)}
          columns={columns as any}
          data={groupFilter ? filtered.filter((f) => inFunnelGroup(f, reportOf(f.id), previousOf(f.id), groupFilter)) : filtered}
          isLoading={funnelsLoading}
          enableRowSelection={canEdit}
          selectionActions={(selectedRows) => (
            <>
              <span className="text-sm font-medium text-muted-foreground mr-2">
                {selectedRows.length} selected
              </span>
              <Button
                variant="destructive"
                size="sm"
                className="h-8 gap-1.5"
                disabled={bulkDeleteMutation.isPending}
                onClick={async () => {
                  const ok = await confirm({
                    title: `Delete ${selectedRows.length} funnel${selectedRows.length === 1 ? '' : 's'}?`,
                    description: 'The funnels and their conversion history are removed. Your analytics data is not affected.',
                    confirmLabel: 'Delete',
                    destructive: true,
                  });
                  if (ok) bulkDeleteMutation.mutate({ websiteId, funnelIds: selectedRows.map(r => r.id) });
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            </>
          )}
          toolbarLeft={
            <div>
              <h3 className=" font-semibold text-foreground">Funnels</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {filtered.length} funnel{filtered.length !== 1 ? 's' : ''} configured
              </p>
            </div>
          }
          toolbarRight={
            <div className="relative w-64 h-8 bg-card border border-border rounded-lg overflow-hidden flex items-center px-2.5 gap-2 group focus-within:ring-1 focus-within:ring-primary/20 focus-within:border-primary/40 transition-all">
              <Search className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
              <input
                type="text"
                placeholder="Search funnels..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent border-none outline-none text-xs w-full placeholder:text-muted-foreground/60"
              />
            </div>
          }
          pageSize={10}
        />

      </div>

      <ListGroups
        className="mt-6"
        title="Funnels by trend"
        description="How each funnel is doing in this period. Open a group to see its funnels."
        groups={FUNNEL_GROUP_META.map((meta) => ({
          ...meta,
          items: funnels
            .filter((f) => inFunnelGroup(f, reportOf(f.id), previousOf(f.id), meta.id))
            .map((f) => ({
              key: f.id,
              text: `${f.name} — ${funnelLine(f, reportOf(f.id), previousOf(f.id))}`,
              onClick: () => router.push(`/websites/${websiteId}/funnels/${f.id}`),
            })),
        }))}
        onShowAll={(id) => { setGroupFilter(id as FunnelGroupId); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
      />

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
