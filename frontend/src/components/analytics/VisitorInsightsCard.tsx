'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VisitorInsightsData } from '@/lib/analytics-api';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface VisitorInsightsCardProps {
  data?: VisitorInsightsData;
  isLoading?: boolean;
  className?: string;
}

export function VisitorInsightsCard({ data, isLoading, className = '' }: VisitorInsightsCardProps) {
  if (isLoading) {
    return (
      <Card className={cn("bg-card border-border shadow-sm shadow-black/5 rounded overflow-hidden", className)}>
        <CardHeader className="pb-2">
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <div className="h-48 bg-accent/5 rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  const chartData = [
    {
      name: 'New Visitors',
      value: data?.new_visitors || 0,
      color: 'var(--primary)', 
    },
    {
      name: 'Returning Visitors',
      value: data?.returning_visitors || 0,
      color: '#10B981', 
    },
  ];

  const total = (data?.new_visitors || 0) + (data?.returning_visitors || 0);

  const formatDuration = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}m ${sec}s`;
  };

  return (
    <Card className={cn("bg-card border-border shadow-sm shadow-black/5 rounded overflow-hidden", className)}>
      <CardHeader className="pb-4">
        <div className="space-y-1">
          <CardTitle className="text-lg font-bold tracking-tight">Visitor Insights</CardTitle>
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest opacity-50">Retention & Session depth</p>
        </div>
      </CardHeader>
      <CardContent className="p-6 pt-0">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Chart Section */}
            <div className="h-44 bg-accent/5 rounded p-4 border border-border/40">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ left: -20, right: 20, top: 10, bottom: 10 }}>
                     <XAxis type="number" hide />
                     <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10, fontWeight: 600, fill: 'currentColor', opacity: 0.5}} axisLine={false} tickLine={false} />
                     <Tooltip 
                        cursor={{fill: 'var(--accent)', opacity: 0.1}}
                        contentStyle={{ 
                            backgroundColor: 'var(--card)', 
                            borderColor: 'var(--border)',
                            borderRadius: '12px',
                            fontSize: '11px',
                            fontWeight: 700
                        }}
                     />
                     <Bar dataKey="value" barSize={16} radius={[0, 8, 8, 0]}>
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                     </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Stats Section */}
            <div className="flex flex-col justify-center space-y-0">
                <div className="flex items-center justify-between py-4 border-b border-border/40 hover:bg-accent/5 transition-colors group px-1">
                    <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-primary ring-2 ring-primary/10"></div>
                        <div>
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest opacity-50">New Visitors</p>
                            <p className="text-lg font-bold text-foreground">
                                {data?.new_visitors?.toLocaleString() || 0}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-1.5 py-0.5 rounded">
                            {total > 0 ? ((data?.new_visitors || 0) / total * 100).toFixed(0) : 0}%
                        </p>
                    </div>
                </div>

                <div className="flex items-center justify-between py-4 hover:bg-accent/5 transition-colors group px-1">
                    <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#10B981] ring-2 ring-[#10B981]/10"></div>
                        <div>
                            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest opacity-50">Returning</p>
                            <p className="text-lg font-bold text-foreground">
                                {data?.returning_visitors?.toLocaleString() || 0}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest bg-blue-500/10 px-1.5 py-0.5 rounded">
                            {total > 0 ? ((data?.returning_visitors || 0) / total * 100).toFixed(0) : 0}%
                        </p>
                    </div>
                </div>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
