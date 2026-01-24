'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '@/components/ui/tooltip';

interface CohortRow {
  week: string;
  size: number;
  retention: number[]; // Percentages
}

interface RetentionCohortChartProps {
  data?: any;
  isLoading?: boolean;
}

export function RetentionCohortChart({ data, isLoading }: RetentionCohortChartProps) {
  if (isLoading) {
    return (
      <Card className="bg-card border shadow-sm dark:bg-gray-800 rounded-md h-full">
        <CardHeader>
          <div className="h-5 w-40 bg-muted rounded animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="h-64 bg-muted rounded animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  // Fallback to demo structure if cohorts aren't present
  const cohorts: CohortRow[] = data?.cohorts || [
    { week: 'Cohort', size: 0, retention: [100, data?.day_1 || 0, data?.day_7 || 0, data?.day_30 || 0] }
  ];

  const maxWeeks = Math.max(...cohorts.map(c => c.retention.length));

  const getIntensityClass = (value: number) => {
    if (value === 100) return 'bg-blue-600 dark:bg-blue-500 text-white';
    if (value >= 50) return 'bg-blue-500/80 dark:bg-blue-400/80 text-white';
    if (value >= 30) return 'bg-blue-500/60 dark:bg-blue-400/60 text-white';
    if (value >= 20) return 'bg-blue-500/40 dark:bg-blue-400/40 text-blue-900 dark:text-blue-100';
    if (value >= 10) return 'bg-blue-500/20 dark:bg-blue-400/20 text-blue-800 dark:text-blue-200';
    if (value > 0) return 'bg-blue-500/10 dark:bg-blue-400/10 text-blue-700 dark:text-blue-300';
    return 'bg-muted/30 text-muted-foreground';
  };

  return (
    <Card className="bg-card border shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none dark:bg-gray-800 rounded-md overflow-hidden">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base font-medium">User Retention</CardTitle>
            <p className="text-xs text-muted-foreground">Percentage of users who return over time</p>
          </div>
          <div className="flex gap-2">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm bg-blue-600"></div>
              <span className="text-[10px] text-muted-foreground">High</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-sm bg-blue-500/10"></div>
              <span className="text-[10px] text-muted-foreground">Low</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-0 sm:px-6">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/30">
                <th className="p-2 text-left w-24">Cohort</th>
                <th className="p-2 text-center w-20">Size</th>
                {Array.from({ length: maxWeeks }).map((_, i) => (
                  <th key={i} className="p-2 text-center w-16">
                    {i === 0 ? 'Entry' : `Wk ${i}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y dark:divide-gray-700">
              {cohorts.map((cohort, idx) => (
                <tr key={idx} className="hover:bg-muted/20 transition-colors">
                  <td className="p-2 text-xs font-semibold whitespace-nowrap">{cohort.week}</td>
                  <td className="p-2 text-center text-xs font-medium text-muted-foreground">{cohort.size.toLocaleString()}</td>
                  {cohort.retention.map((value, i) => (
                    <td key={i} className="p-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className={`
                              h-8 flex items-center justify-center text-[11px] font-bold rounded-sm cursor-default transition-all hover:scale-105 hover:shadow-sm
                              ${getIntensityClass(value)}
                            `}>
                              {value}%
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="text-[10px] font-medium">
                            <p>{cohort.week} cohort</p>
                            <p>{Math.round(cohort.size * (value / 100)).toLocaleString()} users returned</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </td>
                  ))}
                  {/* Fill empty cells for shorter retention arrays */}
                  {Array.from({ length: maxWeeks - cohort.retention.length }).map((_, i) => (
                    <td key={`empty-${i}`} className="p-1">
                      <div className="h-8 bg-muted/5 rounded-sm"></div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
