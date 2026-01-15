'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrafficChart } from './TrafficChart';
import { cn } from '@/lib/utils';

interface TrafficOverviewProps {
  dailyStats: any;
  hourlyStats: any;
  isLoading: boolean;
  className?: string;
}

export function TrafficOverview({
  dailyStats,
  hourlyStats,
  isLoading,
  className,
}: TrafficOverviewProps) {
  return (
    <Card className={cn("col-span-full shadow-sm border-gray-200 dark:border-gray-800", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
        <CardTitle className="text-base font-semibold">Traffic Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[350px]">
           <TrafficChart data={dailyStats} isLoading={isLoading} />
        </div>
      </CardContent>
    </Card>
  );
}
