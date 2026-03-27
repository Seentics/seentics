'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useGoalStats } from '@/lib/analytics-api';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { DataTable, SortableHeader, ColumnDef } from '@/components/ui/data-table';
import { StatCards } from '@/components/seentics-ui/StatCards';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Target, PlusCircle, Search, TrendingUp, CheckCircle2, BarChart3 } from 'lucide-react';
import { AddGoalModal } from '@/components/websites/modals/AddGoalModal';

const GOAL_TYPE_LABEL: Record<string, string> = {
  pageview: 'Page Visit',
  event:    'Custom Event',
  click:    'CSS Click',
};

const GOAL_TYPE_COLOR: Record<string, string> = {
  pageview: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300',
  event:    'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300',
  click:    'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300',
};

export default function GoalsPage() {
  const params = useParams();
  const router = useRouter();
  const websiteId = params?.websiteId as string;

  const [dateRange, setDateRange] = useState(7);
  const [search, setSearch] = useState('');
  const [showAddGoal, setShowAddGoal] = useState(false);

  const { data: goalData, isLoading } = useGoalStats(websiteId, dateRange);
  const goals = goalData?.goals ?? [];

  const filtered = useMemo(() =>
    goals.filter((g: any) =>
      !search || g.name.toLowerCase().includes(search.toLowerCase()) ||
      (g.target ?? '').toLowerCase().includes(search.toLowerCase())
    ),
    [goals, search]
  );

  const totalConversions = goals.reduce((s: number, g: any) => s + (g.completions || 0), 0);
  const avgRate = goals.length
    ? (goals.reduce((s: number, g: any) => s + (g.conversion_rate || 0), 0) / goals.length)
    : 0;
  const topGoal = [...goals].sort((a: any, b: any) => (b.completions || 0) - (a.completions || 0))[0];

  const columns: ColumnDef<any>[] = [
    {
      id: 'name',
      header: ({ column }) => <SortableHeader column={column}>Goal</SortableHeader>,
      accessorKey: 'name',
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{row.original.name}</p>
          {row.original.target && (
            <p className="text-xs text-muted-foreground font-mono truncate">{row.original.target}</p>
          )}
        </div>
      ),
    },
    {
      id: 'type',
      header: 'Type',
      accessorKey: 'goal_type',
      size: 120,
      cell: ({ getValue }) => {
        const type = getValue() as string;
        return (
          <Badge className={`text-xs border whitespace-nowrap ${GOAL_TYPE_COLOR[type] ?? 'bg-muted text-muted-foreground'}`}>
            {GOAL_TYPE_LABEL[type] ?? type}
          </Badge>
        );
      },
    },
    {
      id: 'completions',
      header: ({ column }) => <SortableHeader column={column}>Completions</SortableHeader>,
      accessorKey: 'completions',
      size: 120,
      cell: ({ getValue }) => (
        <span className="text-sm font-semibold text-foreground">
          {(getValue() as number || 0).toLocaleString()}
        </span>
      ),
    },
    {
      id: 'conversion_rate',
      header: ({ column }) => <SortableHeader column={column}>Conversion</SortableHeader>,
      accessorKey: 'conversion_rate',
      size: 160,
      cell: ({ getValue }) => {
        const rate = getValue() as number || 0;
        return (
          <div className="flex items-center gap-2">
            <Progress value={Math.min(rate, 100)} className="h-1.5 flex-1" />
            <span className="text-xs font-semibold w-10 text-right shrink-0">{rate.toFixed(1)}%</span>
          </div>
        );
      },
    },
  ];

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1200px] mx-auto">
      <DashboardPageHeader
        title="Goals"
        description="Track page visits, custom events, and CSS selector clicks."
        icon={Target}
      />

      <StatCards
        isLoading={isLoading}
        cards={[
          { label: 'Total Goals',   value: goals.length, icon: Target },
          { label: 'Completions',   value: totalConversions, icon: CheckCircle2, iconColor: 'text-green-600', valueColor: 'text-green-600' },
          { label: 'Avg Conv. Rate', value: `${avgRate.toFixed(1)}%`, icon: TrendingUp, iconColor: 'text-blue-600' },
          { label: 'Top Goal',      value: topGoal?.name ?? '—', icon: BarChart3 },
        ]}
      />

      <DataTable
        data={filtered}
        columns={columns}
        isLoading={isLoading}
        toolbarLeft={
          <div>
            <h3 className="text-sm font-semibold text-foreground">Goals</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">{filtered.length} goal{filtered.length !== 1 ? 's' : ''} configured</p>
          </div>
        }
        toolbarRight={
          <>
            <Select value={String(dateRange)} onValueChange={v => setDateRange(Number(v))}>
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[7, 14, 30, 90].map(d => (
                  <SelectItem key={d} value={String(d)} className="text-xs">Last {d} days</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search goals..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs w-44"
              />
            </div>
            <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setShowAddGoal(true)}>
              <PlusCircle className="h-3.5 w-3.5" />
              Add Goal
            </Button>
          </>
        }
        onRowClick={(row) => router.push(`/websites/${websiteId}/goals/${row.id}`)}
        emptyIcon={<Target className="h-6 w-6" />}
        emptyTitle="No goals yet"
        emptyDescription="Create your first goal to track conversions."
        emptyAction={
          <Button size="sm" onClick={() => setShowAddGoal(true)}>
            <PlusCircle className="h-3.5 w-3.5 mr-1.5" />
            Add Goal
          </Button>
        }
      />

      <AddGoalModal open={showAddGoal} onOpenChange={setShowAddGoal} websiteId={websiteId} />
    </div>
  );
}
