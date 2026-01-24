'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VisitorInsightsData } from '@/lib/analytics-api';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface VisitorInsightsCardProps {
  data?: VisitorInsightsData;
  isLoading?: boolean;
  className?: string;
}

export function VisitorInsightsCard({ data, isLoading, className = '' }: VisitorInsightsCardProps) {
  if (isLoading) {
    return (
      <Card className={`bg-card border-0 shadow-sm dark:bg-gray-800 rounded-md ${className}`}>
        <CardHeader>
          <div className="h-5 w-32 bg-muted rounded animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="h-48 bg-muted rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  const chartData = [
    {
      name: 'New Visitors',
      value: data?.new_visitors || 0,
      color: '#3B82F6', // Blue
    },
    {
      name: 'Returning Visitors',
      value: data?.returning_visitors || 0,
      color: '#10B981', // Green
    },
  ];

  const total = (data?.new_visitors || 0) + (data?.returning_visitors || 0);

  // Helper for duration
  const formatDuration = (seconds: number) => {
    const min = Math.floor(seconds / 60);
    const sec = Math.floor(seconds % 60);
    return `${min}m ${sec}s`;
  };

  return (
    <Card className={`bg-card border shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none dark:bg-gray-800 rounded-md ${className}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium text-foreground">Visitor Insights</CardTitle>
        <p className="text-xs text-muted-foreground">New vs Returning & Session Duration</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Chart Section */}
            <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 20 }}>
                     <XAxis type="number" hide />
                     <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} />
                     <Tooltip 
                        cursor={{fill: 'transparent'}}
                        contentStyle={{ borderRadius: '8px' }}
                     />
                     <Bar dataKey="value" barSize={20} radius={[0, 4, 4, 0]}>
                        {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                     </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Stats Section */}
            <div className="flex flex-col justify-center space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                            <span className="text-sm text-foreground">New</span>
                        </div>
                        <div className="text-xl font-bold ml-5">
                            {data?.new_visitors?.toLocaleString() || 0}
                        </div>
                    </div>
                     <span className="text-xs text-muted-foreground">{total > 0 ? Math.round(((data?.new_visitors || 0) / total) * 100) : 0}%</span>
                </div>
                 <div className="flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-green-500"></div>
                            <span className="text-sm text-foreground">Returning</span>
                        </div>
                        <div className="text-xl font-bold ml-5">
                            {data?.returning_visitors?.toLocaleString() || 0}
                        </div>
                    </div>
                     <span className="text-xs text-muted-foreground">{total > 0 ? Math.round(((data?.returning_visitors || 0) / total) * 100) : 0}%</span>
                </div>
                 <div className="pt-2 border-t mt-2">
                      <div className="text-sm text-muted-foreground">Avg Session Duration</div>
                       <div className="text-xl font-bold">
                            {formatDuration(data?.avg_session_duration || 0)}
                        </div>
                 </div>
            </div>
        </div>
      </CardContent>
    </Card>
  );
}
