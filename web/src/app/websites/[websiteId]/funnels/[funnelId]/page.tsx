'use client';

import { useParams, useRouter } from 'next/navigation';
import { useFunnels, useFunnelAnalytics } from '@/lib/analytics-api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  ArrowLeft, GitBranch, TrendingUp, TrendingDown, Users,
  Target, BarChart3, Clock, ArrowRight,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCards } from '@/components/seentics-ui/StatCards';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

export default function FunnelDetailPage() {
  const params = useParams();
  const router = useRouter();
  const websiteId = params?.websiteId as string;
  const funnelId = params?.funnelId as string;

  const { data: funnels = [], isLoading: funnelsLoading } = useFunnels(websiteId);
  const { data: analyticsData, isLoading: analyticsLoading } = useFunnelAnalytics(funnelId, 30, websiteId);

  const funnel = funnels.find(f => f.id === funnelId);
  const analytics = analyticsData?.analytics?.[0];

  if (funnelsLoading) {
    return (
      <div className="p-8 space-y-6">
        <Skeleton className="h-8 w-48" />
        <StatCards cards={[]} isLoading={true} />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (!funnel) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p className="text-sm">Funnel not found.</p>
        <Button variant="ghost" size="sm" className="mt-4" onClick={() => router.back()}>
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Back
        </Button>
      </div>
    );
  }

  const steps = funnel.steps || [];
  const metrics = analytics?.step_metrics || [];

  return (
    <div className="w-full max-w-[1440px] mx-auto p-4 md:p-6 lg:p-8">
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => router.push(`/websites/${websiteId}/funnels`)}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Funnels
        </Button>
      </div>

      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <GitBranch className="h-5 w-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground">{funnel.name}</h1>
            <Badge variant={funnel.is_active ? 'default' : 'secondary'} className="text-[10px]">
              {funnel.is_active ? 'Active' : 'Paused'}
            </Badge>
          </div>
          {funnel.description && (
            <p className="text-sm text-muted-foreground">{funnel.description}</p>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <StatCards
        isLoading={analyticsLoading}
        cards={[
          {
            label: 'Total Entries',
            value: analytics?.total_starts || 0,
            icon: Users
          },
          {
            label: 'Conversions',
            value: analytics?.total_conversions || 0,
            icon: Target,
            iconColor: 'text-green-600',
            valueColor: 'text-green-600'
          },
          {
            label: 'Avg Conv. Rate',
            value: `${(analytics?.conversion_rate || 0).toFixed(1)}%`,
            icon: TrendingUp,
            iconColor: 'text-blue-600'
          },
          {
            label: 'Drop-off Rate',
            value: `${(analytics?.drop_off_rate || 0).toFixed(1)}%`,
            icon: TrendingDown,
            iconColor: 'text-orange-600'
          },
        ]}
      />

      {/* Funnel Visualization */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border border-border/60 bg-card shadow-sm overflow-hidden">
          <CardHeader className="px-5 py-4 border-b border-border/40 bg-muted/20">
            <CardTitle className="text-sm font-semibold">Funnel Steps Visualization</CardTitle>
          </CardHeader>
          <CardContent className="p-5">
            <div className="space-y-4">
              {steps.map((step, i) => {
                const metric = metrics.find((m: any) => m.step === (i + 1));
                const count = metric?.count || 0;
                const drop_off = metric?.drop_off || 0;
                const drop_off_rate = metric?.drop_off_rate || 0;
                
                const isLast = i === steps.length - 1;
                const totalStarts = analytics?.total_starts || 1;
                const widthPct = Math.max((count / totalStarts) * 100, 3);
                
                return (
                  <div key={step.id || i} className="group">
                    <div className="flex items-start gap-4">
                      {/* Step index */}
                      <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                        {i + 1}
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">{step.name}</span>
                            <Badge variant="outline" className="text-[10px] h-4.5 bg-background uppercase font-bold tracking-tighter opacity-70">
                              {step.type}
                            </Badge>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-bold">{count.toLocaleString()}</span>
                            <span className="text-[10px] text-muted-foreground ml-1.5 font-medium">hits</span>
                          </div>
                        </div>
                        
                        {/* Progress Bar Container */}
                        <div className="relative h-2.5 bg-muted rounded-full overflow-hidden mb-2">
                          <div
                            className="absolute inset-y-0 left-0 bg-primary/80 group-hover:bg-primary transition-all duration-500 rounded-full"
                            style={{ width: `${widthPct}%` }}
                          />
                        </div>

                        {/* Drop-off Info */}
                        {!isLast && drop_off > 0 && (
                          <div className="flex items-center gap-2 mt-2 px-1 text-[11px] font-medium animate-in fade-in slide-in-from-left-2">
                            <TrendingDown size={12} className="text-orange-500" />
                            <span className="text-orange-600">{drop_off.toLocaleString()} users dropped off</span>
                            <span className="text-muted-foreground/40 text-[10px]">—</span>
                            <span className="text-muted-foreground">{drop_off_rate.toFixed(1)}% drop-off rate</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {!isLast && (
                        <div className="ml-4 pl-4 py-2 border-l-2 border-dashed border-border/60">
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-medium uppercase tracking-widest pl-2">
                                <ArrowRight size={10} /> Next step
                            </div>
                        </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border border-border/60 bg-card shadow-sm">
            <CardHeader className="px-5 py-4 border-b border-border/40">
              <CardTitle className="text-sm font-semibold">Step Conversion</CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <div className="space-y-4">
                {steps.map((step, i) => {
                  const metric = metrics.find((m: any) => m.step === (i + 1));
                  const percentage = analytics?.total_starts ? (metric?.count || 0) / analytics.total_starts * 100 : 0;
                  return (
                    <div key={step.id || i} className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[11px] font-bold text-muted-foreground w-4 shrink-0">#{i + 1}</span>
                        <span className="text-xs truncate font-medium">{step.name}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="h-1 w-12 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${percentage}%` }} />
                        </div>
                        <span className="text-xs font-bold tabular-nums w-10 text-right">{percentage.toFixed(1)}%</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card className="border border-border/60 bg-card shadow-sm">
            <CardHeader className="px-5 py-4 border-b border-border/40">
              <CardTitle className="text-sm font-semibold font-mono">Conditions</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {steps.map((step, i) => (
                <div key={step.id || i} className="px-5 py-4 border-b border-border/30 last:border-0 hover:bg-muted/10 transition-colors">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="text-[10px] font-bold text-primary/70">{i + 1}</span>
                    <span className="text-xs font-semibold">{step.name}</span>
                  </div>
                   <div className="font-mono text-[10px] p-2 rounded bg-muted/30 border border-border/40 overflow-x-auto whitespace-pre">
                    {JSON.stringify(step.condition, null, 2)}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
