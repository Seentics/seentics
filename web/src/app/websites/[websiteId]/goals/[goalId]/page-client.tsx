'use client';

import { usePathSegment } from '@/lib/path-segment';

import { useRouter } from 'next/navigation';
import { useGoalStats } from '@/features/analytics/queries';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Target } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCards } from '@/components/seentics-ui/StatCards';
import { useT } from '@/lib/i18n';

/*
 * Only what the goals endpoint returns: completions, unique visitors and the conversion
 * rate over the last 30 days. This page used to draw a "completions over 30 days" chart
 * from Math.random() and show completions × 0.8 as visitors when there were none — there is
 * no per-day goal series in the API, so the chart is gone rather than invented.
 */

export default function GoalDetailPage() {
  const params = { websiteId: usePathSegment(1) ?? '', goalId: usePathSegment(3) ?? '' };
  const router = useRouter();
  const t = useT().analytics;
  const actions = useT().actions;
  const websiteId = params?.websiteId as string;
  const goalId = params?.goalId as string;

  const { data: goalData, isLoading } = useGoalStats(websiteId, 30);
  const goals = goalData?.goals ?? [];
  const goal = goals.find((g: any) => String(g.id) === goalId);

  if (isLoading) {
    return (
      <div className="p-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  if (!goal) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p className="text-sm">{t.goalDetail.notFound}</p>
        <Button variant="ghost" size="sm" className="mt-4" onClick={() => router.back()}>
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> {actions.back}
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-5 lg:px-6 lg:py-5 max-w-[1200px] mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => router.push(`/websites/${websiteId}`)}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t.goalDetail.backToAnalytics}
        </Button>
      </div>

      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Target className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground">{goal.name}</h1>
            <Badge variant="outline" className="text-xs">
              {t.goals.types[goal.goal_type] ?? goal.goal_type}
            </Badge>
          </div>
          {goal.target && (
            <p className="text-sm text-muted-foreground font-mono">{goal.target}</p>
          )}
        </div>
      </div>

      {/* Stats */}
      <StatCards
        cols={3}
        cards={[
          {
            label: t.goals.completions,
            value: goal.completions ?? 0,
          },
          {
            label: t.goals.conversionRate,
            value: `${(goal.conversion_rate || 0).toFixed(1)}%`,
          },
          {
            label: t.goalDetail.uniqueVisitors,
            value: goal.unique_visitors ?? 0,
          },
        ]}
      />

      {/* Conversion bar */}
      <Card className="border border-border">
        <CardHeader className="px-5 py-4 border-b border-border">
          <CardTitle className="text-sm font-semibold">{t.goals.conversionRate}</CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            <Progress value={Math.min(goal.conversion_rate || 0, 100)} className="flex-1 h-3" />
            <span className="text-2xl font-bold text-primary">{(goal.conversion_rate || 0).toFixed(1)}%</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {t.goalDetail.completionsOutOf((goal.completions || 0).toLocaleString())}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
