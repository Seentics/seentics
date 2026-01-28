'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
  Area, 
  AreaChart, 
  CartesianGrid, 
  ResponsiveContainer, 
  Tooltip, 
  XAxis, 
  YAxis 
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowUpRight, Zap } from 'lucide-react';
import Link from 'next/link';

interface AutomationChartProps {
  data?: any;
  isLoading: boolean;
}

// Generate mock data for the chart if real data isn't provided
const generateMockData = () => {
  const data = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    data.push({
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      triggers: Math.floor(Math.random() * 500) + 200,
      actions: Math.floor(Math.random() * 450) + 180,
    });
  }
  return data;
};

export const AutomationChart: React.FC<AutomationChartProps> = ({ data, isLoading }) => {
  const chartData = data?.automation_history || generateMockData();

  if (isLoading) {
    return (
      <Card className="col-span-1 shadow-lg border-primary/10 rounded overflow-hidden dark:bg-gray-800 h-full">
        <CardHeader className="border-b pb-4">
           <div className="h-6 w-48 bg-muted rounded animate-pulse" />
        </CardHeader>
        <CardContent className="p-6">
           <div className="h-[250px] w-full bg-muted/20 rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="col-span-1 shadow-lg border-primary/10 rounded overflow-hidden dark:bg-gray-800 h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between border-b pb-4 shrink-0">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold">Automation Activity</CardTitle>
            <Badge variant="outline" className="text-[10px] px-1.5 h-4 font-black border-blue-500 text-blue-500 bg-blue-500/5">LIVE</Badge>
          </div>
          <CardDescription className="text-xs">Triggers fired vs Actions executed</CardDescription>
        </div>
        <Link href="https://automation.seentics.com" target="_blank">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                <ArrowUpRight size={16} />
            </Button>
        </Link>
      </CardHeader>
      
      <CardContent className="p-0 flex-1 min-h-[300px] relative">
        <div className="absolute inset-0 pt-6 pb-2 px-2">
            <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                <linearGradient id="colorTriggers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorActions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/20" vertical={false} />
                <XAxis 
                    dataKey="date" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                    dy={10}
                />
                <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                    dx={-10}
                />
                <Tooltip
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    cursor={{ stroke: 'var(--muted-foreground)', strokeWidth: 1, strokeDasharray: '4 4' }}
                />
                <Area
                    type="monotone"
                    dataKey="triggers"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorTriggers)"
                    name="Triggers"
                />
                <Area
                    type="monotone"
                    dataKey="actions"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorActions)"
                    name="Actions"
                />
            </AreaChart>
            </ResponsiveContainer>
        </div>
      </CardContent>
      
      <div className="p-3 border-t border-border bg-muted/5 flex justify-center gap-6 shrink-0">
         <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-blue-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Triggers</span>
         </div>
         <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Actions Executed</span>
         </div>
      </div>
    </Card>
  );
};
