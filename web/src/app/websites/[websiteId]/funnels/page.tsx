'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQueries } from '@tanstack/react-query';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { StatCards } from '@/components/seentics-ui/StatCards';
import { GitBranch, TrendingUp, Users, Target, MoreVertical, Eye, Edit, Trash2, Plus, Calendar, BarChart3, Search } from 'lucide-react';
import { isDemo } from '@/lib/demo';
import {
  analyticsKeys,
  getFunnelAnalytics,
  useFunnels,
  useFunnelAnalytics,
  useDeleteFunnel,
  useDeleteFunnels,
  type Funnel,
} from '@/lib/analytics-api';
import { DataTable, selectionColumn } from '@/components/ui/data-table';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { FunnelBuilder } from '@/components/analytics/FunnelBuilder';
import { Skeleton } from '@/components/ui/skeleton';

// Helper component for stats in the table cell
function FunnelCellStats({ funnelId, dateRange }: { funnelId: string; dateRange: number }) {
  const { data: analytics, isLoading } = useFunnelAnalytics(funnelId, dateRange);
  const item = analytics?.analytics?.[0];

  if (isLoading) {
    return <Skeleton className="h-4 w-24" />;
  }

  if (!item) return <span className="text-muted-foreground">—</span>;

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold">{(item.conversion_rate || 0).toFixed(1)}%</span>
        <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tighter">Conv.</span>
      </div>
      <div className="text-[10px] text-muted-foreground">
        {item.total_conversions?.toLocaleString()} of {item.total_starts?.toLocaleString()}
      </div>
    </div>
  );
}

export default function FunnelsPage() {
  const params = useParams();
  const router = useRouter();
  const websiteId = params?.websiteId as string;
  const isDemoMode = isDemo(websiteId);

  const [dateRange] = useState(30);
  const [search, setSearch] = useState('');
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingFunnel, setEditingFunnel] = useState<Funnel | null>(null);

  const { data: funnels = [], isLoading: funnelsLoading } = useFunnels(websiteId);
  const funnelIds = useMemo(() => funnels.map(f => f.id), [funnels]);
  const funnelAnalyticsQueries = useQueries({
    queries: funnelIds.map(funnelId => ({
      queryKey: [...analyticsKeys.all, 'funnel-analytics', funnelId, dateRange] as const,
      queryFn:  () => getFunnelAnalytics(funnelId, dateRange),
      enabled:  !isDemoMode && funnelIds.length > 0,
    })),
  });
  const avgConvLoading =
    !isDemoMode && funnelIds.length > 0 && funnelAnalyticsQueries.some(q => q.isPending);
  const avgConversionStr = useMemo(() => {
    if (isDemoMode || funnelIds.length === 0) return '';
    const rates = funnelAnalyticsQueries
      .map(q => q.data?.analytics?.[0]?.conversion_rate)
      .filter((r): r is number => typeof r === 'number' && !Number.isNaN(r));
    if (!rates.length) return '—';
    const avg = rates.reduce((a, b) => a + b, 0) / rates.length;
    return `${avg.toFixed(1)}%`;
  }, [isDemoMode, funnelIds.length, funnelAnalyticsQueries]);
  const deleteFunnelMutation = useDeleteFunnel();
  const bulkDeleteMutation = useDeleteFunnels();


  const handleDeleteFunnel = (id: string) => {
    if (confirm('Delete this funnel?')) {
      deleteFunnelMutation.mutate(id);
    }
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
    selectionColumn<Funnel>(),
    {
      id: 'name',
      header: 'Funnel Name',
      accessorKey: 'name',
      cell: ({ row }: { row: any }) => (
        <div
          className="flex flex-col gap-1 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={() => router.push(`/websites/${websiteId}/funnels/${row.original.id}`)}
        >
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm">{row.original.name}</span>
            <Badge variant="outline" className="text-[9px] h-4.5 px-1.5 uppercase font-bold tracking-tighter bg-muted/20">
              {row.original.steps?.length || 0} steps
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate max-w-[200px]">{row.original.description || 'No description'}</p>
        </div>
      )
    },
    {
      id: 'status',
      header: 'Status',
      accessorKey: 'is_active',
      size: 100,
      cell: ({ getValue }: { getValue: any }) => {
        const active = getValue() as boolean;
        return (
          <Badge variant={active ? 'default' : 'secondary'} className="text-[10px] h-5 px-2">
            {active ? 'Active' : 'Paused'}
          </Badge>
        );
      }
    },
    {
      id: 'performance',
      header: 'Performance (30d)',
      cell: ({ row }: { row: any }) => <FunnelCellStats funnelId={row.original.id} dateRange={dateRange} />
    },
    {
      id: 'created',
      header: 'Created',
      accessorKey: 'created_at',
      size: 120,
      cell: ({ getValue }: { getValue: any }) => (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Calendar size={12} className="opacity-50" />
          {new Date(getValue() as string).toLocaleDateString()}
        </div>
      )
    },
    {
      id: 'actions',
      header: '',
      size: 50,
      cell: ({ row }: { row: any }) => (
        <div className="flex justify-end pr-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical size={14} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem onClick={() => router.push(`/websites/${websiteId}/funnels/${row.original.id}`)}>
                <Eye size={12} className="mr-2" /> View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setEditingFunnel(row.original); setIsBuilderOpen(true); }}>
                <Edit size={12} className="mr-2" /> Edit Funnel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleDeleteFunnel(row.original.id)} className="text-destructive font-medium">
                <Trash2 size={12} className="mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )
    }
  ], [websiteId, dateRange, router]);


  // Summary Metrics
  const summary = useMemo(() => {
    if (isDemoMode) {
      return [
        { label: 'Active Funnels', value: 3, icon: GitBranch },
        { label: 'Avg Completion', value: '24.3%', icon: TrendingUp, iconColor: 'text-blue-600' },
        { label: 'Total Entries', value: '48,291', icon: Users },
        { label: 'Conversions', value: '11,726', icon: Target, iconColor: 'text-green-600', valueColor: 'text-green-600' },
      ];
    }
    return [
      { label: 'Active Funnels', value: funnels.filter(f => f.is_active).length, icon: GitBranch },
      { label: 'Total Funnels', value: funnels.length, icon: BarChart3 },
      { label: 'Total Steps', value: funnels.reduce((s, f) => s + (f.steps?.length || 0), 0), icon: Target },
      {
        label:      'Avg. conversion',
        value:     funnelIds.length === 0 ? '—' : avgConversionStr,
        icon:       TrendingUp,
        iconColor: 'text-blue-600',
      },
    ];
  }, [isDemoMode, funnels, funnelIds.length, avgConversionStr]);

  return (
    <div className="w-full max-w-[1440px] mx-auto p-4 md:p-6 lg:p-8">
      <DashboardPageHeader
        title="Funnels"
        description="Track conversion steps and identify where users drop off in their journey."
        icon={GitBranch}
      >
        <Button
          onClick={() => { setEditingFunnel(null); setIsBuilderOpen(true); }}
          size="sm"
          className="h-8 gap-1.5"
        >
          <Plus size={14} /> New Funnel
        </Button>
      </DashboardPageHeader>

      <StatCards cards={summary} isLoading={funnelsLoading || avgConvLoading} />

      <div className="mt-8">
        <DataTable
          columns={columns as any}
          data={filtered}
          isLoading={funnelsLoading}
          enableRowSelection={true}
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
                onClick={() => {
                  if (confirm(`Are you sure you want to delete ${selectedRows.length} funnel(s)?`)) {
                    bulkDeleteMutation.mutate({ websiteId, funnelIds: selectedRows.map(r => r.id) });
                  }
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </Button>
            </>
          )}
          toolbarLeft={
            <div>
              <h3 className="text-sm font-semibold text-foreground">Funnels</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {filtered.length} funnel{filtered.length !== 1 ? 's' : ''} configured
              </p>
            </div>
          }
          toolbarRight={
            <div className="relative w-64 h-8 bg-card border border-border/40 rounded-md overflow-hidden flex items-center px-2.5 gap-2 group focus-within:ring-1 focus-within:ring-primary/20 focus-within:border-primary/40 transition-all">
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
        />

      </div>

      {/* Create/Edit Funnel Modal */}
      <Dialog open={isBuilderOpen} onOpenChange={setIsBuilderOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto border border-border/60 bg-card rounded-xl shadow-xl p-0 gap-0">
          <DialogHeader className="p-5 pb-3 border-b border-border/60">
            <DialogTitle className="text-base font-semibold tracking-tight">
              {editingFunnel ? `Edit Funnel: ${editingFunnel.name}` : 'Create New Funnel'}
            </DialogTitle>
          </DialogHeader>
          <div className="p-5">
            <FunnelBuilder
              websiteId={websiteId}
              existingFunnel={editingFunnel || undefined}
              onSave={() => setIsBuilderOpen(false)}
              onCancel={() => {
                setIsBuilderOpen(false);
                setEditingFunnel(null);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
