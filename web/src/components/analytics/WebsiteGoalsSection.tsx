'use client';

import { useMemo, useState } from 'react';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useGoalStats, analyticsKeys } from '@/features/analytics/queries';
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

export function WebsiteGoalsSection({
  websiteId,
  days,
  enabled = true,
}: {
  websiteId: string;
  days: number;
  /** False holds both reads back — the dashboard loads this section after what is above it. */
  enabled?: boolean;
}) {
  const queryClient = useQueryClient();
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [confirm, confirmDialog] = useConfirm();
  const [editingGoalForModal, setEditingGoalForModal] = useState<Goal | null>(null);
  const [detailGoal, setDetailGoal] = useState<GoalRow | null>(null);

  const { data: goalData, isPending } = useGoalStats(websiteId, days, enabled);
  const isLoading = enabled ? isPending : true;

  const { data: goalDefinitions = [] } = useQuery({
    queryKey: ['goals', websiteId],
    queryFn: () => getGoals(websiteId),
    enabled: enabled && isValidId(websiteId),
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
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="shrink-0 truncate text-sm font-medium text-foreground">{String(row.original.name ?? '')}</span>
            {row.original.target ? (
              <span className="min-w-0 max-w-[220px] truncate font-mono text-xs text-muted-foreground">{String(row.original.target)}</span>
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
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
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
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                title="Delete goal"
                aria-label="Delete goal"
                disabled={deleteGoalMutation.isPending}
                onClick={async () => {
                  const ok = await confirm({
                    title: 'Delete this goal?',
                    description: 'Its conversion counts stop being tracked. This cannot be undone.',
                    confirmLabel: 'Delete goal',
                    destructive: true,
                  });
                  if (ok) deleteGoalMutation.mutate(id);
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

  if (!websiteId) return null;

  return (
    <>
      {confirmDialog}
      <Card className="border border-border bg-card overflow-hidden">
        <CardHeader className="p-4 border-b border-border">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-sm font-semibold tracking-tight">Goals</h3>
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
            className="border-0 rounded-none shadow-none bg-transparent [&_thead]:bg-muted/30"
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
              <DialogHeader className="p-5 pb-4 border-b border-border space-y-3 text-left">
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
                  <div className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
                    <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span className="text-[10px] font-medium uppercase tracking-wide">Completions</span>
                    </div>
                    <p className="text-lg font-bold tabular-nums">{(detailGoal.completions ?? 0).toLocaleString()}</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
                    <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                      <TrendingUp className="h-3.5 w-3.5" />
                      <span className="text-[10px] font-medium uppercase tracking-wide">Conv.</span>
                    </div>
                    <p className="text-lg font-bold tabular-nums">{(detailGoal.conversion_rate ?? 0).toFixed(1)}%</p>
                  </div>
                  <div className="rounded-lg border border-border bg-muted/20 px-3 py-2.5">
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

                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Conversion rate</p>
                  <div className="flex items-center gap-3">
                    <Progress value={Math.min(detailGoal.conversion_rate ?? 0, 100)} className="flex-1 h-2" />
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
