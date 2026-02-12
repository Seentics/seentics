'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowRight, Target, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface GoalPath {
  path: string[];
  conversions: number;
  conversionRate: number;
  totalVisitors: number;
}

interface GoalCompletionPathsProps {
  paths: GoalPath[];
  isLoading?: boolean;
  goalName?: string;
}

export function GoalCompletionPaths({ paths, isLoading, goalName = 'Conversion' }: GoalCompletionPathsProps) {
  if (isLoading) {
    return (
      <Card className="bg-card/50">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!paths || paths.length === 0) {
    return (
      <Card className="bg-card/50">
        <CardHeader>
          <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Goal Completion Paths
          </CardTitle>
          <CardDescription>See how users reach your conversion goals</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Target className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground">No conversion paths yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Start tracking goals to see user journeys.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxConversions = Math.max(...paths.map(p => p.conversions));

  return (
    <Card className="bg-card/50 shadow-sm border-border/40">
      <CardHeader className="border-b border-border/40">
        <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          Goal Completion Paths
        </CardTitle>
        <CardDescription>Most common user journeys to {goalName}</CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-4">
          {paths.map((pathData, index) => (
            <div
              key={index}
              className="group p-4 rounded-lg border border-border/50 bg-card hover:border-primary/30 hover:bg-card/80 transition-all duration-200"
            >
              {/* Path Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                    #{index + 1}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {pathData.totalVisitors.toLocaleString()} visitors
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-lg font-black text-primary">
                      {pathData.conversionRate.toFixed(1)}%
                    </div>
                    <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                      Conversion Rate
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-black text-foreground">
                      {pathData.conversions.toLocaleString()}
                    </div>
                    <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">
                      Conversions
                    </div>
                  </div>
                </div>
              </div>

              {/* Path Flow */}
              <div className="flex items-center gap-2 flex-wrap">
                {pathData.path.map((step, stepIndex) => (
                  <React.Fragment key={stepIndex}>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50 border border-border/50 group-hover:bg-muted transition-colors">
                      <span className="text-sm font-medium text-foreground truncate max-w-[150px]">
                        {step}
                      </span>
                    </div>
                    {stepIndex < pathData.path.length - 1 && (
                      <ArrowRight className="h-4 w-4 text-muted-foreground/50 flex-shrink-0" />
                    )}
                  </React.Fragment>
                ))}
              </div>

              {/* Progress Bar */}
              <div className="mt-3">
                <div className="h-2 w-full bg-muted/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500"
                    style={{ width: `${(pathData.conversions / maxConversions) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary Stats */}
        <div className="mt-6 p-4 rounded-lg bg-muted/30 border border-border/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-muted-foreground">Total Paths Analyzed</span>
            </div>
            <span className="text-lg font-bold text-foreground">{paths.length}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
