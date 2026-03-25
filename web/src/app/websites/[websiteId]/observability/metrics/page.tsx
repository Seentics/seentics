'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useMetrics, MetricBucket } from '@/lib/observability-api';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Gauge, TrendingUp, TrendingDown } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function MetricCard({ name, buckets }: { name: string; buckets: MetricBucket[] }) {
  if (buckets.length === 0) return null;

  const latest = buckets[buckets.length - 1];
  const first  = buckets[0];
  const trend  = latest.avg - first.avg;

  const chartData = buckets.map(b => ({
    time: b.bucket.split('T')[1]?.slice(0, 5) ?? b.bucket,
    avg:  parseFloat(b.avg.toFixed(3)),
    max:  parseFloat(b.max.toFixed(3)),
  }));

  return (
    <Card className="border border-border/60">
      <CardHeader className="px-4 py-3 border-b border-border/60">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold font-mono">{name}</CardTitle>
          <div className="flex items-center gap-1 text-xs">
            {trend >= 0
              ? <TrendingUp className="h-3.5 w-3.5 text-green-500" />
              : <TrendingDown className="h-3.5 w-3.5 text-red-500" />}
            <span className="font-mono font-semibold">{latest.avg.toFixed(2)}</span>
          </div>
        </div>
        <div className="flex gap-4 text-xs text-muted-foreground mt-1">
          <span>min: {Math.min(...buckets.map(b => b.min)).toFixed(2)}</span>
          <span>avg: {(buckets.reduce((s, b) => s + b.avg, 0) / buckets.length).toFixed(2)}</span>
          <span>max: {Math.max(...buckets.map(b => b.max)).toFixed(2)}</span>
        </div>
      </CardHeader>
      <CardContent className="px-4 pt-3 pb-4">
        <ResponsiveContainer width="100%" height={120}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={`grad-${name}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
            <XAxis dataKey="time" tick={{ fontSize: 10 }} stroke="transparent" />
            <YAxis tick={{ fontSize: 10 }} width={40} stroke="transparent" />
            <Tooltip
              contentStyle={{ fontSize: 11, border: '1px solid hsl(var(--border))', borderRadius: 6 }}
            />
            <Area
              type="monotone"
              dataKey="avg"
              stroke="hsl(var(--primary))"
              strokeWidth={1.5}
              fill={`url(#grad-${name})`}
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export default function MetricsPage() {
  const params = useParams();
  const projectId = params?.websiteId as string;

  const [service, setService] = useState('');
  const [granularity, setGranularity] = useState<'minute' | 'hour' | 'day'>('hour');

  const { data, isLoading } = useMetrics(projectId, service || undefined, undefined, undefined, undefined, granularity);
  const buckets = data?.metrics ?? [];

  // Group buckets by metric name
  const byName = buckets.reduce<Record<string, MetricBucket[]>>((acc, b) => {
    (acc[b.name] ??= []).push(b);
    return acc;
  }, {});

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1200px] mx-auto">
      <DashboardPageHeader
        title="Metrics"
        description="Push custom gauges, counters, and histograms from any service."
        icon={Gauge}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Input
          placeholder="Filter by service"
          value={service}
          onChange={e => setService(e.target.value)}
          className="w-[160px] h-8 text-xs"
        />
        <Select value={granularity} onValueChange={v => setGranularity(v as any)}>
          <SelectTrigger className="w-[120px] h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="minute" className="text-xs">By minute</SelectItem>
            <SelectItem value="hour"   className="text-xs">By hour</SelectItem>
            <SelectItem value="day"    className="text-xs">By day</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="border border-border/60">
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : Object.keys(byName).length === 0 ? (
        <Card className="border border-border/60">
          <CardContent className="py-16 text-center text-muted-foreground text-sm">
            No metrics yet. Start pushing metrics via the SDK or HTTP API.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {Object.entries(byName).map(([name, buckets]) => (
            <MetricCard key={name} name={name} buckets={buckets} />
          ))}
        </div>
      )}
    </div>
  );
}
