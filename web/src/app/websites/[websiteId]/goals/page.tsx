'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useGoalStats } from '@/lib/analytics-api';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Target, PlusCircle } from 'lucide-react';
import { AddGoalModal } from '@/components/websites/modals/AddGoalModal';
import { cn } from '@/lib/utils';

function conversionBar(rate: number) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${Math.min(rate, 100)}%` }}
        />
      </div>
      <span className="text-xs font-semibold w-10 text-right">{rate.toFixed(1)}%</span>
    </div>
  );
}

const GOAL_TYPE_LABEL: Record<string, string> = {
  pageview: 'Page Visit',
  event:    'Custom Event',
  click:    'CSS Click',
};

export default function GoalsPage() {
  const params = useParams();
  const websiteId = params?.websiteId as string;

  const [dateRange, setDateRange] = useState(7);
  const [showAddGoal, setShowAddGoal] = useState(false);

  const { data: goalData, isLoading } = useGoalStats(websiteId, dateRange);
  const goals = goalData?.goals ?? [];

  const totalConversions = goals.reduce((s: number, g: any) => s + (g.completions || 0), 0);

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1200px] mx-auto">
      <DashboardPageHeader
        title="Goals"
        description="Track page visits, custom events, and CSS selector clicks."
        icon={Target}
      >
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
        <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setShowAddGoal(true)}>
          <PlusCircle className="h-3.5 w-3.5" />
          Add Goal
        </Button>
      </DashboardPageHeader>

      {/* Summary */}
      {!isLoading && goals.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="border border-border/60">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Total goals</p>
              <p className="text-2xl font-bold">{goals.length}</p>
            </CardContent>
          </Card>
          <Card className="border border-border/60">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Completions</p>
              <p className="text-2xl font-bold">{totalConversions.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="border border-border/60 col-span-2">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground mb-1">Top goal</p>
              <p className="text-sm font-semibold truncate">
                {goals.sort((a: any, b: any) => (b.completions || 0) - (a.completions || 0))[0]?.name ?? '—'}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Goals table */}
      <Card className="border border-border/60">
        <CardContent className="p-0">
          <div className="flex items-center gap-4 px-5 py-2.5 border-b border-border/60 bg-muted/30 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            <span className="flex-1">Goal</span>
            <span className="w-24">Type</span>
            <span className="w-24 text-right">Completions</span>
            <span className="w-32">Conversion</span>
          </div>

          {isLoading ? (
            <div>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-border/40">
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </div>
          ) : goals.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">
              No goals yet.{' '}
              <button onClick={() => setShowAddGoal(true)} className="text-primary underline">
                Add your first goal
              </button>
            </div>
          ) : (
            goals.map((goal: any, i: number) => (
              <div key={goal.id ?? i} className="flex items-center gap-4 px-5 py-4 border-b border-border/40 last:border-0 hover:bg-muted/20 transition-colors">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{goal.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{goal.target}</p>
                </div>
                <Badge variant="secondary" className="text-xs w-24 justify-center shrink-0">
                  {GOAL_TYPE_LABEL[goal.goal_type] ?? goal.goal_type}
                </Badge>
                <span className="text-sm font-semibold w-24 text-right shrink-0">
                  {(goal.completions || 0).toLocaleString()}
                </span>
                <div className="w-32 shrink-0">
                  {conversionBar(goal.conversion_rate || 0)}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <AddGoalModal
        open={showAddGoal}
        onOpenChange={setShowAddGoal}
        websiteId={websiteId}
      />
    </div>
  );
}
