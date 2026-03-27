'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { DataTable, SortableHeader, ColumnDef } from '@/components/ui/data-table';
import { StatCards } from '@/components/seentics-ui/StatCards';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Flame, Eye, MousePointer, Move, Percent, Search, Activity,
} from 'lucide-react';
import { isDemo } from '@/lib/demo';
import { demoHeatmapPages } from '@/lib/demo/heatmaps';
import { cn } from '@/lib/utils';

type HeatmapPage = ReturnType<typeof demoHeatmapPages>[0];

export default function HeatmapsPage() {
  const params = useParams();
  const router = useRouter();
  const websiteId = params?.websiteId as string;
  const isDemoMode = isDemo(websiteId);

  const [search, setSearch] = useState('');

  const pages = isDemoMode ? demoHeatmapPages() : [];

  const filtered = useMemo(() =>
    pages.filter(p => !search || p.url.toLowerCase().includes(search.toLowerCase())),
    [pages, search]
  );

  const totalViews   = pages.reduce((s, p) => s + p.views, 0);
  const totalClicks  = pages.reduce((s, p) => s + p.clicks, 0);
  const avgScroll    = pages.length ? Math.round(pages.reduce((s, p) => s + p.avg_scroll, 0) / pages.length) : 0;
  const activePages  = pages.filter(p => p.active).length;

  const columns: ColumnDef<HeatmapPage>[] = [
    {
      id: 'url',
      header: ({ column }) => <SortableHeader column={column}>Page</SortableHeader>,
      accessorKey: 'url',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className={cn(
            'h-1.5 w-1.5 rounded-full shrink-0',
            row.original.active ? 'bg-green-500' : 'bg-muted-foreground/30',
          )} />
          <span className="font-mono text-sm text-foreground">{row.original.url}</span>
          {row.original.active && (
            <Badge className="text-[10px] h-4 px-1.5 bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 border">
              live
            </Badge>
          )}
        </div>
      ),
    },
    {
      id: 'views',
      header: ({ column }) => <SortableHeader column={column}>Page Views</SortableHeader>,
      accessorKey: 'views',
      size: 120,
      cell: ({ getValue }) => (
        <span className="text-sm font-semibold">{(getValue() as number).toLocaleString()}</span>
      ),
    },
    {
      id: 'clicks',
      header: ({ column }) => <SortableHeader column={column}>Clicks</SortableHeader>,
      accessorKey: 'clicks',
      size: 100,
      cell: ({ getValue }) => (
        <span className="text-sm font-semibold">{(getValue() as number).toLocaleString()}</span>
      ),
    },
    {
      id: 'avg_scroll',
      header: ({ column }) => <SortableHeader column={column}>Avg Scroll</SortableHeader>,
      accessorKey: 'avg_scroll',
      size: 140,
      cell: ({ getValue }) => {
        const v = getValue() as number;
        return (
          <div className="flex items-center gap-2">
            <Progress value={v} className="h-1.5 flex-1" />
            <span className="text-xs font-semibold w-8 text-right shrink-0">{v}%</span>
          </div>
        );
      },
    },
    {
      id: 'click_rate',
      header: ({ column }) => <SortableHeader column={column}>Click Rate</SortableHeader>,
      accessorFn: row => ((row.clicks / row.views) * 100),
      size: 100,
      cell: ({ getValue }) => {
        const rate = getValue() as number;
        return (
          <span className={cn(
            'text-sm font-semibold',
            rate >= 30 ? 'text-green-600' : rate >= 15 ? 'text-amber-600' : 'text-muted-foreground',
          )}>
            {rate.toFixed(1)}%
          </span>
        );
      },
    },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1200px] mx-auto">
      <DashboardPageHeader
        title="Heatmaps"
        description="See where users click, move, and how far they scroll on each page."
        icon={Flame}
      />

      <StatCards cards={[
        { label: 'Total Page Views', value: totalViews, icon: Eye },
        { label: 'Total Clicks',     value: totalClicks, icon: MousePointer, iconColor: 'text-primary' },
        { label: 'Avg Scroll Depth', value: `${avgScroll}%`, icon: Move, iconColor: 'text-indigo-600' },
        { label: 'Active Pages',     value: activePages, icon: Activity, iconColor: 'text-green-600', valueColor: 'text-green-600' },
      ]} />

      <DataTable
        data={filtered}
        columns={columns}
        toolbarLeft={
          <div>
            <h3 className="text-sm font-semibold text-foreground">Heatmap Pages</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">{filtered.length} page{filtered.length !== 1 ? 's' : ''} tracked</p>
          </div>
        }
        toolbarRight={
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search pages..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs w-48"
            />
          </div>
        }
        onRowClick={(row) => router.push(`/websites/${websiteId}/heatmaps/${encodeURIComponent(row.url.replace(/\//g, '_'))}`)}
        emptyIcon={<Flame className="h-6 w-6" />}
        emptyTitle="No heatmap data yet"
        emptyDescription="Install the tracker script to start collecting heatmap data."
      />
    </div>
  );
}
