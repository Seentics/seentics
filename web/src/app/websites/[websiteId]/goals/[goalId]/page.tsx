'use client';

import { useParams, useRouter } from 'next/navigation';
import { useGoalStats } from '@/lib/analytics-api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft, Target, CheckCircle2, TrendingUp, Calendar,
  MousePointer, Globe, BarChart3,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCards } from '@/components/seentics-ui/StatCards';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

const GOAL_TYPE_LABEL: Record<string, string> = {
  pageview: 'Page Visit',
  event: 'Custom Event',
  click: 'CSS Click',
};

// Generate demo sparkline data
function demoTrend(completions: number) {
  return Array.from({ length: 30 }, (_, i) => ({
    day: `Day ${i + 1}`,
    completions: Math.max(0, Math.floor((completions / 30) * (0.5 + Math.random()))),
  }));
}

export default function GoalDetailPage() {
  const params = useParams();
  const router = useRouter();
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
        <p className="text-sm">Goal not found.</p>
        <Button variant="ghost" size="sm" className="mt-4" onClick={() => router.back()}>
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Back
        </Button>
      </div>
    );
  }

  const trendData = demoTrend(goal.completions || 0);

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1200px] mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => router.push(`/websites/${websiteId}`)}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to analytics
        </Button>
      </div>

      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Target className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground">{goal.name}</h1>
            <Badge variant="outline" className="text-xs">
              {GOAL_TYPE_LABEL[goal.goal_type] ?? goal.goal_type}
            </Badge>
          </div>
          {goal.target && (
            <p className="text-sm text-muted-foreground font-mono">{goal.target}</p>
          )}
        </div>
      </div>

      {/* Stats */}
      <StatCards
        cards={[
          {
            label: 'Completions',
            value: goal.completions ?? 0,
            icon: CheckCircle2,
            tone: 'success',
          },
          {
            label: 'Conversion Rate',
            value: `${(goal.conversion_rate || 0).toFixed(1)}%`,
            icon: TrendingUp,
            tone: 'accent',
          },
          {
            label: 'Unique Visitors',
            value: goal.unique_visitors || Math.floor((goal.completions || 0) * 0.8),
            icon: Globe,
            tone: 'info',
          },
          {
            label: 'Last 30 days',
            value: goal.completions ?? 0,
            icon: Calendar,
            tone: 'warning',
          },
        ]}
      />

      {/* Chart */}
      <Card className="border border-border mb-6">
        <CardHeader className="px-5 py-4 border-b border-border">
          <CardTitle className="text-sm font-semibold">Completions over 30 days</CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="goalGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} interval={4} />
              <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
              />
              <Area type="monotone" dataKey="completions" stroke="hsl(var(--primary))" fill="url(#goalGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Conversion bar */}
      <Card className="border border-border">
        <CardHeader className="px-5 py-4 border-b border-border">
          <CardTitle className="text-sm font-semibold">Conversion Rate</CardTitle>
        </CardHeader>
        <CardContent className="p-5">
          <div className="flex items-center gap-4">
            <Progress value={Math.min(goal.conversion_rate || 0, 100)} className="flex-1 h-3" />
            <span className="text-2xl font-bold text-primary">{(goal.conversion_rate || 0).toFixed(1)}%</span>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {(goal.completions || 0).toLocaleString()} completions out of total sessions
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
