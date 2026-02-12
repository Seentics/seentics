'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Zap, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PageSpeedData {
  page: string;
  score: number; // 0-100
  loadTime: number; // milliseconds
  status: 'fast' | 'average' | 'slow';
  trend: 'up' | 'down' | 'stable';
  views: number;
}

interface PageSpeedScoresProps {
  pages: PageSpeedData[];
  isLoading?: boolean;
}

export function PageSpeedScores({ pages, isLoading }: PageSpeedScoresProps) {
  if (isLoading) {
    return (
      <Card className="bg-card/50">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!pages || pages.length === 0) {
    return (
      <Card className="bg-card/50">
        <CardHeader>
          <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Page Speed Scores
          </CardTitle>
          <CardDescription>Performance metrics for your pages</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Zap className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground">No page speed data available yet.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-500 bg-emerald-500/10';
    if (score >= 50) return 'text-amber-500 bg-amber-500/10';
    return 'text-rose-500 bg-rose-500/10';
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return 'Fast';
    if (score >= 50) return 'Average';
    return 'Slow';
  };

  return (
    <Card className="bg-card/50 shadow-sm border-border/40">
      <CardHeader className="border-b border-border/40">
        <CardTitle className="text-lg font-bold tracking-tight flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          Page Speed Scores
        </CardTitle>
        <CardDescription>Performance metrics for your most visited pages</CardDescription>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-3">
          {pages.map((page, index) => (
            <div
              key={index}
              className="group p-4 rounded-lg border border-border/50 bg-card hover:border-primary/30 hover:bg-card/80 transition-all duration-200"
            >
              <div className="flex items-center justify-between gap-4">
                {/* Page Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-sm font-medium truncate">{page.page}</p>
                    {page.trend === 'up' && (
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                    )}
                    {page.trend === 'down' && (
                      <TrendingDown className="h-3.5 w-3.5 text-rose-500 flex-shrink-0" />
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{page.loadTime}ms load time</span>
                    <span>•</span>
                    <span>{page.views.toLocaleString()} views</span>
                  </div>
                </div>

                {/* Score */}
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className={cn(
                      "text-2xl font-black",
                      page.score >= 90 ? 'text-emerald-500' : 
                      page.score >= 50 ? 'text-amber-500' : 'text-rose-500'
                    )}>
                      {page.score}
                    </div>
                    <Badge 
                      variant="outline" 
                      className={cn("text-[10px] font-bold", getScoreColor(page.score))}
                    >
                      {getScoreLabel(page.score)}
                    </Badge>
                  </div>

                  {/* Score Bar */}
                  <div className="w-2 h-12 bg-muted/30 rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "w-full transition-all duration-500",
                        page.score >= 90 ? "bg-emerald-500" : 
                        page.score >= 50 ? "bg-amber-500" : "bg-rose-500"
                      )}
                      style={{ height: `${page.score}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Summary Stats */}
        <div className="mt-6 grid grid-cols-3 gap-4">
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <div className="text-xl font-black text-emerald-500">
              {pages.filter(p => p.score >= 90).length}
            </div>
            <div className="text-xs text-muted-foreground font-medium">Fast Pages</div>
          </div>
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <div className="text-xl font-black text-amber-500">
              {pages.filter(p => p.score >= 50 && p.score < 90).length}
            </div>
            <div className="text-xs text-muted-foreground font-medium">Average Pages</div>
          </div>
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20">
            <div className="text-xl font-black text-rose-500">
              {pages.filter(p => p.score < 50).length}
            </div>
            <div className="text-xs text-muted-foreground font-medium">Slow Pages</div>
          </div>
        </div>

        {/* Recommendations */}
        {pages.some(p => p.score < 50) && (
          <div className="mt-4 p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground mb-1">Performance Tip</p>
                <p className="text-xs text-muted-foreground">
                  You have slow-loading pages. Consider optimizing images, reducing JavaScript, 
                  and enabling caching to improve load times.
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
