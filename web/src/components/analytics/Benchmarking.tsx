'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus, Award } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BenchmarkData {
  metric: string;
  yourValue: number;
  industryAverage: number;
  percentile: number; // 0-100, where you rank
  trend: 'up' | 'down' | 'stable';
  unit?: string;
  format?: 'number' | 'percentage' | 'duration';
}

interface BenchmarkingProps {
  benchmarks: BenchmarkData[];
  isLoading?: boolean;
}

export function Benchmarking({ benchmarks, isLoading }: BenchmarkingProps) {
  const formatValue = (value: number, format?: string, unit?: string) => {
    switch (format) {
      case 'percentage':
        return `${value.toFixed(1)}%`;
      case 'duration':
        return `${value.toFixed(1)}${unit || 's'}`;
      default:
        return value.toLocaleString() + (unit || '');
    }
  };

  const getPerformanceColor = (percentile: number) => {
    if (percentile >= 75) return 'text-emerald-500 bg-emerald-500/10';
    if (percentile >= 50) return 'text-blue-500 bg-blue-500/10';
    if (percentile >= 25) return 'text-amber-500 bg-amber-500/10';
    return 'text-rose-500 bg-rose-500/10';
  };

  const getPerformanceLabel = (percentile: number) => {
    if (percentile >= 75) return 'Excellent';
    if (percentile >= 50) return 'Good';
    if (percentile >= 25) return 'Average';
    return 'Needs Work';
  };

  if (isLoading || !benchmarks || benchmarks.length === 0) {
    return null;
  }

  return (
    <Card className="bg-card/50 shadow-sm border-border/40">
      <CardHeader className="border-b border-border/40">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" />
              Industry Benchmarks
            </CardTitle>
            <CardDescription>See how you compare to similar sites</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-4">
          {benchmarks.map((benchmark, index) => {
            const difference = benchmark.yourValue - benchmark.industryAverage;
            const differencePercent = ((difference / benchmark.industryAverage) * 100).toFixed(1);
            const isPositive = difference > 0;
            const performanceColor = getPerformanceColor(benchmark.percentile);
            const performanceLabel = getPerformanceLabel(benchmark.percentile);

            return (
              <div
                key={index}
                className="p-4 rounded-lg border border-border/50 bg-card hover:bg-card/80 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-semibold text-sm mb-1">{benchmark.metric}</h4>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={cn("text-xs font-bold", performanceColor)}>
                        {performanceLabel}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Top {benchmark.percentile}%
                      </span>
                    </div>
                  </div>
                  {benchmark.trend === 'up' && (
                    <TrendingUp className="h-5 w-5 text-emerald-500" />
                  )}
                  {benchmark.trend === 'down' && (
                    <TrendingDown className="h-5 w-5 text-rose-500" />
                  )}
                  {benchmark.trend === 'stable' && (
                    <Minus className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Your Site</p>
                    <p className="text-2xl font-black text-foreground">
                      {formatValue(benchmark.yourValue, benchmark.format, benchmark.unit)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Industry Avg</p>
                    <p className="text-2xl font-black text-muted-foreground/60">
                      {formatValue(benchmark.industryAverage, benchmark.format, benchmark.unit)}
                    </p>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                    <span>Performance</span>
                    <span>
                      {isPositive ? '+' : ''}
                      {differencePercent}% vs avg
                    </span>
                  </div>
                  <div className="h-2 w-full bg-muted/30 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full transition-all duration-500",
                        benchmark.percentile >= 75 ? "bg-emerald-500" :
                        benchmark.percentile >= 50 ? "bg-blue-500" :
                        benchmark.percentile >= 25 ? "bg-amber-500" : "bg-rose-500"
                      )}
                      style={{ width: `${benchmark.percentile}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Info Footer */}
        <div className="mt-6 p-4 rounded-lg bg-muted/30 border border-border/50">
          <p className="text-xs text-muted-foreground">
            <strong>Note:</strong> Benchmarks are based on industry averages from similar websites in your category.
            Data is updated monthly.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
