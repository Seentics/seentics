
'use client';

import { BarChart, Users, Eye, ArrowRight, Loader2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from '@/components/ui/card';
import { type DashboardData, useDashboardData, useDailyStats, trafficChartConfig } from '@/lib/analytics-api';
import { Area, AreaChart, CartesianGrid, Legend, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartContainer } from './ui/chart';
import Link from 'next/link';
import { Button } from './ui/button';

interface AnalyticsSummaryCardProps {
  siteId: string | null;
}

export function AnalyticsSummaryCard({ siteId }: AnalyticsSummaryCardProps) {
  const { data: dashboardData, isLoading: loadingDashboard } = useDashboardData(siteId || '', 30);
  const { data: dailyStats, isLoading: loadingDaily } = useDailyStats(siteId || '', 30);

  const loading = (!siteId) || loadingDashboard || loadingDaily;

  const totalVisitors = dashboardData?.unique_visitors ?? 0;
  const pageviews = dashboardData?.page_views ?? 0;
  const trafficData = (dailyStats?.daily_stats || []).map((d) => ({ date: d.date, pageviews: d.views }));

  if (!siteId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Analytics Overview</CardTitle>
          <CardDescription>A summary of your website's performance.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-48 text-muted-foreground">
          Select a website to view its analytics summary.
        </CardContent>
      </Card>
    );
  }

  // Demo mode - return demo data with full styling
  if (siteId === 'demo') {
    const totalVisitors = 45678;
    const pageviews = 82345;
    
    // Generate demo chart data
    const trafficData = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return {
        date: date.toISOString().split('T')[0],
        pageviews: Math.floor(Math.random() * 2000 + 500)
      };
    });

    return (
      <Card className="bg-card shadow-sm overflow-hidden">
        <CardHeader className="pb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded">
              <BarChart className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl font-semibold text-foreground">Analytics Overview</CardTitle>
              <CardDescription className="text-sm text-muted-foreground mt-1">
                A quick look at your website's performance over the last 30 days
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <div className="space-y-6">
            {/* Stats Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="group p-4 rounded border border-border/50 hover:border-border hover:shadow-sm transition-all duration-200">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-gradient-to-br from-blue-500/10 to-blue-600/10 rounded flex-shrink-0">
                    <Users className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Total Visitors</p>
                    <p className="text-2xl font-bold text-foreground break-words leading-tight">{totalVisitors.toLocaleString()}</p>
                  </div>
                </div>
              </div>
              <div className="group p-4 rounded border border-border/50 hover:border-border hover:shadow-sm transition-all duration-200">
                <div className="flex items-start gap-4">
                  <div className="p-3 bg-gradient-to-br from-green-500/10 to-green-600/10 rounded flex-shrink-0">
                    <Eye className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-muted-foreground mb-1">Pageviews</p>
                    <p className="text-2xl font-bold text-foreground break-words leading-tight">{pageviews.toLocaleString()}</p>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Chart - Full Width */}
            <div className="w-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900/50 dark:to-slate-800/50 rounded p-4">
              <ChartContainer config={trafficChartConfig} className="w-full h-64">
                <AreaChart data={trafficData} margin={{ left: 8, right: 8, top: 10, bottom: 0 }}>
                  <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  />
                  <YAxis hide />
                  <Tooltip
                    contentStyle={{ 
                      background: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                    }}
                    formatter={(value) => [Number(value).toLocaleString(), 'Pageviews']}
                    labelFormatter={(value) => new Date(value).toLocaleDateString()}
                  />
                  <defs>
                    <linearGradient id="fillTraffic" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <Area 
                    dataKey="pageviews" 
                    type="monotone" 
                    fill="url(#fillTraffic)" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2.5}
                    strokeLinecap="round"
                  />
                </AreaChart>
              </ChartContainer>
            </div>
          </div>
        </CardContent>
        <CardFooter className="px-6 pb-6 pt-0">
          <Button variant="outline" asChild className="group hover:bg-primary hover:text-primary-foreground transition-colors">
            <Link href="/demo/analytics" className="flex items-center gap-2">
              View Full Analytics
              <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="h-6 w-1/2 bg-muted rounded animate-pulse"></div>
          <div className="h-4 w-1/3 bg-muted rounded animate-pulse mt-2"></div>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-48">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const hasAnyData = (totalVisitors > 0) || (pageviews > 0) || (trafficData.length > 0);

  if (!hasAnyData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Analytics Overview</CardTitle>
          <CardDescription>A summary of your website's performance.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center h-48 text-center text-muted-foreground gap-2">
          <BarChart className="h-8 w-8" />
          <p>No analytics data found for this site in the last 30 days.</p>
          <p className="text-xs">(Make sure your tracking code is installed correctly)</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-card shadow-sm overflow-hidden">
      <CardHeader className="pb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded">
            <BarChart className="h-5 w-5 text-white" />
          </div>
          <div>
            <CardTitle className="text-xl font-semibold text-foreground">Analytics Overview</CardTitle>
            <CardDescription className="text-sm text-muted-foreground mt-1">
              A quick look at your website's performance over the last 30 days
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-6 pb-6">
        <div className="space-y-6">
          {/* Stats Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="group p-4 rounded border border-border/50 hover:border-border hover:shadow-sm transition-all duration-200">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-gradient-to-br from-blue-500/10 to-blue-600/10 rounded flex-shrink-0">
                  <Users className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Total Visitors</p>
                  <p className="text-2xl font-bold text-foreground break-words leading-tight">{totalVisitors.toLocaleString()}</p>
                </div>
              </div>
            </div>
            <div className="group p-4 rounded border border-border/50 hover:border-border hover:shadow-sm transition-all duration-200">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-gradient-to-br from-green-500/10 to-green-600/10 rounded flex-shrink-0">
                  <Eye className="h-6 w-6 text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-muted-foreground mb-1">Pageviews</p>
                  <p className="text-2xl font-bold text-foreground break-words leading-tight">{pageviews.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Chart - Full Width */}
          <div className="w-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900/50 dark:to-slate-800/50 rounded p-4">
            <ChartContainer config={trafficChartConfig} className="w-full h-64">
              <AreaChart data={trafficData} margin={{ left: 8, right: 8, top: 10, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(value) => new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ 
                    background: 'hsl(var(--background))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                  }}
                  formatter={(value) => [Number(value).toLocaleString(), 'Pageviews']}
                  labelFormatter={(value) => new Date(value).toLocaleDateString()}
                />
                <defs>
                  <linearGradient id="fillTraffic" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                  </linearGradient>
                </defs>
                <Area 
                  dataKey="pageviews" 
                  type="monotone" 
                  fill="url(#fillTraffic)" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2.5}
                  strokeLinecap="round"
                />
              </AreaChart>
            </ChartContainer>
          </div>
        </div>
      </CardContent>
      <CardFooter className="px-6 pb-6 pt-0">
        <Button variant="outline" asChild className="group hover:bg-primary hover:text-primary-foreground transition-colors">
          <Link href={`/websites/${siteId}/analytics`} className="flex items-center gap-2">
            View Full Analytics
            <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
