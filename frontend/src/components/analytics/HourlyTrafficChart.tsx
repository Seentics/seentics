'use client';

import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { formatNumber } from '@/lib/analytics-api';

interface HourlyTrafficChartProps {
  data: any;
  isLoading: boolean;
}

const commonTooltipProps = {
  contentStyle: {
    backgroundColor: 'hsl(var(--background))',
    border: '1px solid hsl(var(--border))',
    borderRadius: '8px',
    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
    padding: '12px'
  },
  itemStyle: { color: 'hsl(var(--foreground))' },
  labelStyle: { color: 'hsl(var(--muted-foreground))' },
  cursor: { fill: 'hsl(var(--muted) / 0.1)' }
};

export const HourlyTrafficChart: React.FC<HourlyTrafficChartProps> = ({ 
  data, 
  isLoading 
}) => {
  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  const chartData = (data?.hourly_stats || []).map((item: any) => ({
    hour: `${item.hour}:00`,
    views: item.views,
    unique: item.unique
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={chartData} margin={{ top: 16, right: 24, left: 8, bottom: 8 }}>
        <CartesianGrid 
          strokeDasharray="3 3" 
          stroke="hsl(var(--border))" 
          vertical={false}
          opacity={0.3}
        />
        <XAxis
          dataKey="hour"
          stroke="hsl(var(--muted-foreground))"
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          stroke="hsl(var(--muted-foreground))"
          fontSize={11}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value) => formatNumber(value)}
        />
        <Tooltip 
          {...commonTooltipProps} 
          formatter={(value: any) => [formatNumber(value)]}
        />
        <Bar dataKey="views" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Page Views" />
        <Bar dataKey="unique" fill="#10b981" radius={[4, 4, 0, 0]} name="Unique Visitors" />
      </BarChart>
    </ResponsiveContainer>
  );
}; 
