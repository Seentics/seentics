'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, BarChart, Bar } from 'recharts';

interface Props {
  data: {
    timeseries: Array<{ date: string; count: number }>;
    top_events: Array<{ event_type: string; count: number }>;
  } | undefined;
  isLoading: boolean;
}

const formatDate = (iso: string) => {
  try { return new Date(iso).toLocaleDateString(); } catch { return iso; }
};

export const CustomEventsChart: React.FC<Props> = ({ data, isLoading }) => {
  if (isLoading) return <Skeleton className="h-64 w-full" />;

  const series = data?.timeseries || [];
  const top = data?.top_events || [];

  const barData = top.map(t => ({ name: t.event_type, value: t.count })).slice(0, 8);

  if (series.length === 0 && barData.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        <div className="text-center text-sm">No custom events recorded in the selected range</div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <Card className="bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-foreground">Custom Events Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={series} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="ce" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.05}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="date" tickFormatter={formatDate} />
                  <YAxis allowDecimals={false} />
                  <Tooltip labelFormatter={(v) => formatDate(v as string)} />
                  <Area type="monotone" dataKey="count" stroke="#3B82F6" fill="url(#ce)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
      <div>
        <Card className="bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="text-foreground">Top Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} layout="vertical" margin={{ left: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis type="number" allowDecimals={false} hide />
                  <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#10b981" radius={[4,4,4,4]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CustomEventsChart;


