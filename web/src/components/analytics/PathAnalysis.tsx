import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { isValidId } from '@/lib/utils';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LogIn, LogOut, Route, TrendingUp, MoveRight } from 'lucide-react';
import { isEnterprise } from '@/lib/features';
import api from '@/lib/api';
import { isDemo, demoPathAnalysis } from '@/lib/demo';
import { ChartErrorBoundary } from '@/components/analytics/ChartErrorBoundary';

interface PageFlow {
  from_page: string;
  to_page: string;
  count: number;
}

interface TopItem {
  name: string;
  count: number;
}

interface PathAnalysis {
  top_entry_pages: TopItem[];
  top_exit_pages: TopItem[];
  page_flows: PageFlow[];
  avg_path_length: number;
}

function PageListSkeleton() {
  return (
    <div className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-2.5">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-3 flex-1 rounded" />
          <Skeleton className="h-5 w-12 rounded-full" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-2">
      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
        <Route className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

export function PathAnalysis({ websiteId, dateRange }: { websiteId: string; dateRange: number }) {
  const { data, isLoading } = useQuery<PathAnalysis>({
    queryKey: ['path-analysis', websiteId, dateRange],
    queryFn: async () => {
      if (isDemo(websiteId)) {
        const demo = demoPathAnalysis();
        return {
          avg_path_length: demo.avg_path_length,
          top_entry_pages: demo.top_entry_pages.map(p => ({ name: p.page, count: p.count })),
          top_exit_pages: demo.top_exit_pages.map(p => ({ name: p.page, count: p.count })),
          page_flows: demo.page_flows.map(f => ({ from_page: f.from, to_page: f.to, count: f.count })),
        };
      }
      const response = await api.get(`/analytics/path-analysis/${websiteId}?days=${dateRange}`);
      return response.data;
    },
    enabled: isValidId(websiteId) && (isEnterprise || isDemo(websiteId)),
    staleTime: 60 * 1000,
  });

  const topFlowCount = data?.page_flows?.[0]?.count || 1;
  const entryMax = data?.top_entry_pages?.[0]?.count || 1;
  const exitMax = data?.top_exit_pages?.[0]?.count || 1;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        <Route className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold tracking-tight">Path Analysis & User Journeys</h2>
        <div className="h-px bg-border flex-1 ml-3" />
      </div>

      <ChartErrorBoundary label="Path Analysis">
        <div className="space-y-4">
          {/* <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-5 flex items-center gap-4 border border-border/60 shadow-sm">
              <div className="w-11 h-11 rounded-xl bg-indigo-500/10 flex items-center justify-center shrink-0">
                <Route className="h-5 w-5 text-indigo-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-medium mb-0.5">Avg. Path Length</p>
                {isLoading ? (
                  <Skeleton className="h-7 w-16 rounded" />
                ) : (
                  <p className="text-2xl font-black tracking-tight leading-none">
                    {(data?.avg_path_length || 0).toFixed(1)}
                    <span className="text-xs font-normal text-muted-foreground ml-1.5">pages/session</span>
                  </p>
                )}
              </div>
            </Card>

            <Card className="p-5 flex items-center gap-4 border border-border/60 shadow-sm">
              <div className="w-11 h-11 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                <LogIn className="h-5 w-5 text-emerald-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-medium mb-0.5">Top Entry Page</p>
                {isLoading ? (
                  <Skeleton className="h-5 w-32 rounded" />
                ) : (
                  <p className="text-sm font-bold truncate" title={data?.top_entry_pages?.[0]?.name}>
                    {data?.top_entry_pages?.[0]?.name || '—'}
                  </p>
                )}
              </div>
            </Card>

            <Card className="p-5 flex items-center gap-4 border border-border/60 shadow-sm">
              <div className="w-11 h-11 rounded-xl bg-rose-500/10 flex items-center justify-center shrink-0">
                <LogOut className="h-5 w-5 text-rose-500" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground font-medium mb-0.5">Top Exit Page</p>
                {isLoading ? (
                  <Skeleton className="h-5 w-32 rounded" />
                ) : (
                  <p className="text-sm font-bold truncate" title={data?.top_exit_pages?.[0]?.name}>
                    {data?.top_exit_pages?.[0]?.name || '—'}
                  </p>
                )}
              </div>
            </Card>
          </div> */}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="overflow-hidden border border-border/60 shadow-sm">
              <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border/60">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <LogIn className="h-3.5 w-3.5 text-emerald-500" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Entry Pages</h3>
                  <p className="text-[10px] text-muted-foreground leading-none mt-0.5">First page visitors land on</p>
                </div>
              </div>
              <div className="p-3">
                {isLoading ? (
                  <PageListSkeleton />
                ) : (data?.top_entry_pages || []).length === 0 ? (
                  <EmptyState message="No entry page data yet" />
                ) : (
                  <div className="space-y-0.5">
                    {(data?.top_entry_pages || []).map((item, idx) => {
                      const pct = (item.count / entryMax) * 100;
                      return (
                        <div key={item.name} className="group relative rounded-lg overflow-hidden">
                          <div
                            className="absolute inset-y-0 left-0 bg-emerald-500/10 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                          <div className="relative flex items-center gap-3 px-3 py-2.5">
                            <span className="text-[11px] font-medium text-muted-foreground w-5 shrink-0 text-right">
                              {idx + 1}
                            </span>
                            <span
                              className="text-xs font-medium truncate flex-1 text-foreground"
                              title={item.name}
                            >
                              {item.name}
                            </span>
                            <Badge
                              variant="secondary"
                              className="text-[10px] h-5 px-2 shrink-0 font-semibold bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-0"
                            >
                              {item.count.toLocaleString()}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>

            <Card className="overflow-hidden border border-border/60 shadow-sm">
              <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border/60">
                <div className="w-7 h-7 rounded-lg bg-rose-500/10 flex items-center justify-center">
                  <LogOut className="h-3.5 w-3.5 text-rose-500" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Exit Pages</h3>
                  <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Last page before visitors leave</p>
                </div>
              </div>
              <div className="p-3">
                {isLoading ? (
                  <PageListSkeleton />
                ) : (data?.top_exit_pages || []).length === 0 ? (
                  <EmptyState message="No exit page data yet" />
                ) : (
                  <div className="space-y-0.5">
                    {(data?.top_exit_pages || []).map((item, idx) => {
                      const pct = (item.count / exitMax) * 100;
                      return (
                        <div key={item.name} className="group relative rounded-lg overflow-hidden">
                          <div
                            className="absolute inset-y-0 left-0 bg-rose-500/10 transition-all"
                            style={{ width: `${pct}%` }}
                          />
                          <div className="relative flex items-center gap-3 px-3 py-2.5">
                            <span className="text-[11px] font-medium text-muted-foreground w-5 shrink-0 text-right">
                              {idx + 1}
                            </span>
                            <span
                              className="text-xs font-medium truncate flex-1 text-foreground"
                              title={item.name}
                            >
                              {item.name}
                            </span>
                            <Badge
                              variant="secondary"
                              className="text-[10px] h-5 px-2 shrink-0 font-semibold bg-rose-500/10 text-rose-700 dark:text-rose-400 border-0"
                            >
                              {item.count.toLocaleString()}
                            </Badge>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </Card>
          </div>

          <Card className="overflow-hidden border border-border/60 shadow-sm">
            <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border/60">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                <TrendingUp className="h-3.5 w-3.5 text-indigo-500" />
              </div>
              <div>
                <h3 className="text-sm font-semibold">Page Flows</h3>
                <p className="text-[10px] text-muted-foreground leading-none mt-0.5">Most common transitions between pages</p>
              </div>
            </div>

            <div className="p-3">
              {isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 px-3 py-3">
                      <Skeleton className="h-3 w-4 rounded" />
                      <Skeleton className="h-3 flex-1 rounded" />
                      <Skeleton className="h-4 w-6 rounded" />
                      <Skeleton className="h-3 flex-1 rounded" />
                      <Skeleton className="h-5 w-12 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : (data?.page_flows || []).length === 0 ? (
                <EmptyState message="Not enough navigation data yet" />
              ) : (
                <div className="space-y-0.5">
                  {(data?.page_flows || []).map((flow, idx) => {
                    const intensity = (flow.count / topFlowCount) * 100;
                    return (
                      <div key={`${flow.from_page}-${flow.to_page}`} className="group relative rounded-lg overflow-hidden">
                        <div
                          className="absolute inset-y-0 left-0 bg-indigo-500/5 transition-all"
                          style={{ width: `${intensity}%` }}
                        />
                        <div className="relative flex items-center gap-2 px-3 py-2.5">
                          <span className="text-[11px] font-medium text-muted-foreground w-5 shrink-0 text-right">
                            {idx + 1}
                          </span>
                          <span
                            className="text-xs font-medium truncate flex-1 text-foreground"
                            title={flow.from_page}
                          >
                            {flow.from_page}
                          </span>
                          <div className="flex items-center gap-1 shrink-0 text-indigo-500">
                            <MoveRight className="h-3.5 w-3.5" />
                          </div>
                          <span
                            className="text-xs font-medium truncate flex-1 text-foreground"
                            title={flow.to_page}
                          >
                            {flow.to_page}
                          </span>
                          <Badge
                            variant="secondary"
                            className="text-[10px] h-5 px-2 shrink-0 font-semibold bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-0 ml-auto"
                          >
                            {flow.count.toLocaleString()}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </Card>
        </div>
      </ChartErrorBoundary>
    </div>
  );
}
