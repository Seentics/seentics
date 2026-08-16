'use client';

import { useMemo, useId, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useGoalStats, analyticsKeys } from '@/lib/analytics-api';
import { isValidId } from '@/lib/utils';
import { getGoals, deleteGoal, type Goal } from '@/lib/websites-api';
import { toast } from 'sonner';
import { DataTable, SortableHeader, ColumnDef } from '@/components/ui/data-table';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Target, PlusCircle, CheckCircle2, TrendingUp, Globe, Pencil, Trash2 } from 'lucide-react';
import { AddGoalModal } from '@/components/websites/modals/AddGoalModal';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

const GOAL_TYPE_LABEL: Record<string, string> = {
  pageview: 'Page Visit',
  event: 'Custom Event',
  click: 'CSS Click',
};

type GoalRow = {
  id?: string | number;
  name?: string;
  goal_type?: string;
  target?: string;
  completions?: number;
  conversion_rate?: number;
  unique_visitors?: number;
};

function demoTrend(completions: number, points: number) {
  const n = Math.max(7, Math.min(points, 30));
  return Array.from({ length: n }, (_, i) => ({
    day: `D${i + 1}`,
    completions: Math.max(0, Math.round((completions / n) * (0.65 + 0.35 * Math.sin(i / 2)))),
  }));
}

export function WebsiteGoalsSection({
  websiteId,
  days,
}: {
  websiteId: string;
  days: number;
}) {
  const queryClient = useQueryClient();
  const chartGradId = useId().replace(/:/g, '');
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [editingGoalForModal, setEditingGoalForModal] = useState<Goal | null>(null);
  const [detailGoal, setDetailGoal] = useState<GoalRow | null>(null);

  const { data: goalData, isLoading } = useGoalStats(websiteId, days);

  const { data: goalDefinitions = [] } = useQuery({
    queryKey: ['goals', websiteId],
    queryFn: () => getGoals(websiteId),
    enabled: isValidId(websiteId),
  });

  /** Dashboard table uses goal stats rows; API used to return an empty list while definitions existed. */
  const goals = useMemo(() => {
    const statsRows = goalData?.goals ?? [];
    if (statsRows.length > 0) return statsRows;
    if (!goalDefinitions.length) return [];
    return goalDefinitions.map((g) => ({
      id: g.id,
      name: g.name,
      goal_type: g.type,
      target: g.identifier,
      completions: 0,
      conversion_rate: 0,
      unique_visitors: 0,
    }));
  }, [goalData?.goals, goalDefinitions]);

  const deleteGoalMutation = useMutation({
    mutationFn: (goalId: string) => deleteGoal(websiteId, goalId),
    onSuccess: () => {
      toast.success('Goal deleted');
      queryClient.invalidateQueries({ queryKey: ['goals', websiteId] });
      queryClient.invalidateQueries({ queryKey: [...analyticsKeys.all, 'goal-stats', websiteId] });
    },
    onError: (e: Error) => {
      toast.error(e.message || 'Failed to delete goal');
    },
  });

  const columns: ColumnDef<Record<string, unknown>>[] = useMemo(
    () => [
      {
        id: 'name',
        header: ({ column }) => <SortableHeader column={column}>Goal</SortableHeader>,
        accessorKey: 'name',
        cell: ({ row }) => (
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{String(row.original.name ?? '')}</p>
            {row.original.target ? (
              <p className="text-xs text-muted-foreground font-mono truncate">{String(row.original.target)}</p>
            ) : null}
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
            <Badge
              variant="secondary"
              className="text-xs font-normal text-muted-foreground border-0 bg-muted/60 whitespace-nowrap"
            >
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
            {((getValue() as number) || 0).toLocaleString()}
          </span>
        ),
      },
      {
        id: 'conversion_rate',
        header: ({ column }) => <SortableHeader column={column}>Conversion</SortableHeader>,
        accessorKey: 'conversion_rate',
        size: 160,
        cell: ({ getValue }) => {
          const rate = (getValue() as number) || 0;
          return (
            <div className="flex items-center gap-2">
              <Progress value={Math.min(rate, 100)} className="h-1.5 flex-1" />
              <span className="text-xs font-semibold w-10 text-right shrink-0">{rate.toFixed(1)}%</span>
            </div>
          );
        },
      },
      {
        id: 'actions',
        header: '',
        size: 96,
        enableSorting: false,
        cell: ({ row }) => {
          const r = row.original as GoalRow;
          const id = r.id != null ? String(r.id) : '';
          if (!id) return null;
          const def = goalDefinitions.find((g) => g.id === id);
          const mappedType = r.goal_type === 'pageview' ? 'pageview' : 'event';
          const fallback: Goal = {
            id,
            websiteId,
            name: r.name ?? '',
            type: mappedType,
            identifier: r.target ?? '',
            selector: def?.selector ?? null,
            createdAt: def?.createdAt ?? '',
            updatedAt: def?.updatedAt ?? '',
          };
          return (
            <div className="flex justify-end gap-0.5" onClick={(e) => e.stopPropagation()}>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title="Edit goal"
                aria-label="Edit goal"
                onClick={() => {
                  setEditingGoalForModal(def ?? fallback);
                  setShowGoalModal(true);
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                title="Delete goal"
                aria-label="Delete goal"
                disabled={deleteGoalMutation.isPending}
                onClick={() => {
                  if (!confirm('Delete this goal? This cannot be undone.')) return;
                  deleteGoalMutation.mutate(id);
                }}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          );
        },
      },
    ],
    [goalDefinitions, websiteId, deleteGoalMutation.isPending],
  );

  const trendData = useMemo(() => {
    if (!detailGoal) return [];
    return demoTrend(detailGoal.completions || 0, days);
  }, [detailGoal?.id, detailGoal?.completions, days]);

  if (!websiteId) return null;

  return (
    <>
      <Card className="border border-border/60 bg-card shadow-sm overflow-hidden">
        <CardHeader className="p-5 pb-3 border-b border-border/60">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-base font-semibold tracking-tight">Goals</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Track conversions and measure how often visitors complete key actions.</p>
            </div>
            <Button
              size="sm"
              className="h-8 gap-1.5 text-xs w-fit"
              onClick={() => {
                setEditingGoalForModal(null);
                setShowGoalModal(true);
              }}
            >
              <PlusCircle className="h-3.5 w-3.5" />
              Add goal
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <DataTable
            className="border-0 rounded-lg-none shadow-none bg-transparent [&_thead]:bg-muted/30"
            data={goals as Record<string, unknown>[]}
            columns={columns}
            isLoading={isLoading}
            onRowClick={(row) => setDetailGoal(row as GoalRow)}
            emptyIcon={<Target className="h-6 w-6" />}
            emptyTitle="No goals yet"
            emptyDescription="Add a goal to track conversions for this site."
            emptyAction={
              <Button
                size="sm"
                onClick={() => {
                  setEditingGoalForModal(null);
                  setShowGoalModal(true);
                }}
              >
                <PlusCircle className="h-3.5 w-3.5 mr-1.5" />
                Add goal
              </Button>
            }
          />
        </CardContent>
      </Card>

      <Dialog open={detailGoal != null} onOpenChange={(open) => !open && setDetailGoal(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto gap-0 p-0 sm:max-w-lg">
          {detailGoal ? (
            <>
              <DialogHeader className="p-5 pb-4 border-b border-border/40 space-y-3 text-left">
                <div className="flex items-start gap-2 pr-8">
                  <Target className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <DialogTitle className="text-lg font-semibold leading-snug">
                      {detailGoal.name ?? 'Goal'}
                    </DialogTitle>
                    <Badge
                      variant="secondary"
                      className="text-xs font-normal text-muted-foreground border-0 bg-muted/60 mt-2 w-fit"
                    >
                      {GOAL_TYPE_LABEL[detailGoal.goal_type ?? ''] ?? detailGoal.goal_type}
                    </Badge>
                    {detailGoal.target ? (
                      <p className="text-xs text-muted-foreground font-mono mt-2 break-all">{detailGoal.target}</p>
                    ) : null}
                  </div>
                </div>
              </DialogHeader>

              <div className="p-5 space-y-5">
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5">
                    <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span className="text-[10px] font-medium uppercase tracking-wide">Completions</span>
                    </div>
                    <p className="text-lg font-bold tabular-nums">{(detailGoal.completions ?? 0).toLocaleString()}</p>
                  </div>
                  <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5">
                    <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                      <TrendingUp className="h-3.5 w-3.5" />
                      <span className="text-[10px] font-medium uppercase tracking-wide">Conv.</span>
                    </div>
                    <p className="text-lg font-bold tabular-nums">{(detailGoal.conversion_rate ?? 0).toFixed(1)}%</p>
                  </div>
                  <div className="rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5">
                    <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                      <Globe className="h-3.5 w-3.5" />
                      <span className="text-[10px] font-medium uppercase tracking-wide">Visitors</span>
                    </div>
                    <p className="text-lg font-bold tabular-nums">
                      {(detailGoal.unique_visitors ??
                        Math.floor((detailGoal.completions || 0) * 0.8)
                      ).toLocaleString()}
                    </p>
                  </div>
                </div>

                <Card className="border border-border/50 shadow-none">
                  <CardHeader className="px-4 py-3 border-b border-border/30">
                    <p className="text-xs font-semibold text-foreground">Activity trend</p>
                    <p className="text-[11px] text-muted-foreground">Illustrative daily split for the selected period</p>
                  </CardHeader>
                  <CardContent className="p-3 pt-2">
                    <ResponsiveContainer width="100%" height={160}>
                      <AreaChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                        <defs>
                          <linearGradient id={chartGradId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
                        <XAxis dataKey="day" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                        <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{
                            background: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: 8,
                            fontSize: 12,
                          }}
                          labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                        />
                        <Area
                          type="monotone"
                          dataKey="completions"
                          stroke="hsl(var(--primary))"
                          fill={`url(#${chartGradId})`}
                          strokeWidth={2}
                          dot={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Conversion rate</p>
                  <div className="flex items-center gap-3">
                    <Progress value={Math.min(detailGoal.conversion_rate ?? 0, 100)} className="flex-1 h-2.5" />
                    <span className="text-base font-bold text-primary tabular-nums">
                      {(detailGoal.conversion_rate ?? 0).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <AddGoalModal
        open={showGoalModal}
        onOpenChange={(open) => {
          setShowGoalModal(open);
          if (!open) setEditingGoalForModal(null);
        }}
        websiteId={websiteId}
        editingGoal={editingGoalForModal}
      />
    </>
  );
}
