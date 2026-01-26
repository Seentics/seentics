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
      <Card className={cn("bg-card border-border shadow-sm shadow-black/5 rounded-2xl overflow-hidden", className)}>
        <CardHeader className="pb-2">
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
        </CardHeader>
        <CardContent className="p-6 pt-0">
          <div className="h-48 bg-accent/5 rounded-xl animate-pulse" />
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
    <Card className={cn("bg-card border-border shadow-sm shadow-black/5 rounded-2xl overflow-hidden", className)}>
      <CardHeader className="pb-4">
        <div className="space-y-1">
          <CardTitle className="text-xl font-black tracking-tight">Visitor Insights</CardTitle>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] opacity-60">Retention & Session depth</p>
        </div>
      </CardHeader>
      <CardContent className="p-6 pt-0">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Chart Section */}
            <div className="h-44 bg-accent/5 rounded-2xl p-4 border border-border/40">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ left: -20, right: 20, top: 10, bottom: 10 }}>
                     <XAxis type="number" hide />
                     <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 10, fontWeight: 700, fill: 'currentColor', opacity: 0.6}} axisLine={false} tickLine={false} />
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
            <div className="flex flex-col justify-center space-y-6">
                <div className="flex items-center justify-between p-3 rounded-xl bg-accent/5 border border-border/40">
                    <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-primary ring-4 ring-primary/10"></div>
                        <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">New</p>
                            <p className="text-lg font-black text-foreground">
                                {data?.new_visitors?.toLocaleString() || 0}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="text-xs font-black text-primary bg-primary/10 px-2 py-1 rounded-md">{total > 0 ? Math.round(((data?.new_visitors || 0) / total) * 100) : 0}%</span>
                    </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-accent/5 border border-border/40">
                    <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-500/10"></div>
                        <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">Returning</p>
                            <p className="text-lg font-black text-foreground">
                                {data?.returning_visitors?.toLocaleString() || 0}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="text-xs font-black text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-md">{total > 0 ? Math.round(((data?.returning_visitors || 0) / total) * 100) : 0}%</span>
                    </div>
                </div>

                 <div className="pt-4 border-t border-border/40 mt-2">
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60 mb-1">Avg Session Duration</p>
                       <div className="text-2xl font-black text-foreground tracking-tight">
                            {formatDuration(data?.avg_session_duration || 0)}
                        </div>
                 </div>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
