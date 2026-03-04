'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowRight,
  Loader2,
  LogIn,
  LogOut,
  Route,
  TrendingUp,
  ArrowDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { isEnterprise } from '@/lib/features';
import api from '@/lib/api';

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

export default function PathsPage() {
  if (!isEnterprise) return null;

  const params = useParams();
  const websiteId = params?.websiteId as string;
  const [days, setDays] = useState('7');

  const { data, isLoading } = useQuery<PathAnalysis>({
    queryKey: ['path-analysis', websiteId, days],
    queryFn: async () => {
      const response = await api.get(`/analytics/path-analysis/${websiteId}?days=${days}`);
      return response.data;
    },
    enabled: !!websiteId,
    staleTime: 60 * 1000,
  });

  const topFlowCount = data?.page_flows?.[0]?.count || 1;

  return (
    <div className="p-4 sm:p-8 space-y-6 animate-in fade-in duration-500 max-w-[1440px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <DashboardPageHeader
          title="Path Analysis"
          description="Understand how visitors navigate through your website."
        />
        <Select value={days} onValueChange={setDays}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Last 24 hours</SelectItem>
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="14">Last 14 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Route className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Avg. Path Length</p>
                  <p className="text-2xl font-black">{(data?.avg_path_length || 0).toFixed(1)}</p>
                  <p className="text-[10px] text-muted-foreground">pages per session</p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                  <LogIn className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Top Entry Page</p>
                  <p className="text-lg font-bold truncate max-w-[200px]">
                    {data?.top_entry_pages?.[0]?.name || '-'}
                  </p>
                </div>
              </div>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <LogOut className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Top Exit Page</p>
                  <p className="text-lg font-bold truncate max-w-[200px]">
                    {data?.top_exit_pages?.[0]?.name || '-'}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Entry Pages */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <LogIn className="h-4 w-4 text-green-500" />
                <h3 className="text-sm font-bold">Entry Pages</h3>
                <p className="text-[10px] text-muted-foreground ml-auto">Where visitors land</p>
              </div>
              <div className="space-y-1.5">
                {(data?.top_entry_pages || []).map((item, idx) => {
                  const maxCount = data?.top_entry_pages?.[0]?.count || 1;
                  const pct = (item.count / maxCount) * 100;
                  return (
                    <div key={item.name} className="relative">
                      <div
                        className="absolute inset-0 bg-green-500/5 rounded"
                        style={{ width: `${pct}%` }}
                      />
                      <div className="relative flex items-center justify-between py-2 px-3">
                        <span className="text-xs font-medium truncate flex-1 flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground w-4">{idx + 1}.</span>
                          {item.name}
                        </span>
                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 shrink-0">
                          {item.count.toLocaleString()}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
                {(data?.top_entry_pages || []).length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">No data</p>
                )}
              </div>
            </Card>

            {/* Exit Pages */}
            <Card className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <LogOut className="h-4 w-4 text-red-500" />
                <h3 className="text-sm font-bold">Exit Pages</h3>
                <p className="text-[10px] text-muted-foreground ml-auto">Where visitors leave</p>
              </div>
              <div className="space-y-1.5">
                {(data?.top_exit_pages || []).map((item, idx) => {
                  const maxCount = data?.top_exit_pages?.[0]?.count || 1;
                  const pct = (item.count / maxCount) * 100;
                  return (
                    <div key={item.name} className="relative">
                      <div
                        className="absolute inset-0 bg-red-500/5 rounded"
                        style={{ width: `${pct}%` }}
                      />
                      <div className="relative flex items-center justify-between py-2 px-3">
                        <span className="text-xs font-medium truncate flex-1 flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground w-4">{idx + 1}.</span>
                          {item.name}
                        </span>
                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 shrink-0">
                          {item.count.toLocaleString()}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
                {(data?.top_exit_pages || []).length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4">No data</p>
                )}
              </div>
            </Card>
          </div>

          {/* Page Flow Visualization */}
          <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold">Page Flows</h3>
              <p className="text-[10px] text-muted-foreground ml-auto">
                Most common page transitions
              </p>
            </div>
            <div className="space-y-1">
              {(data?.page_flows || []).length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">
                  Not enough data to show page flows yet.
                </p>
              ) : (
                (data?.page_flows || []).map((flow, idx) => {
                  const intensity = (flow.count / topFlowCount) * 100;
                  return (
                    <div key={`${flow.from_page}-${flow.to_page}`} className="relative">
                      <div
                        className="absolute inset-0 bg-primary/5 rounded"
                        style={{ width: `${intensity}%` }}
                      />
                      <div className="relative flex items-center gap-2 py-2.5 px-3">
                        <span className="text-[10px] text-muted-foreground w-5 shrink-0">{idx + 1}.</span>
                        <span className="text-xs font-medium truncate flex-1 max-w-[40%]" title={flow.from_page}>
                          {flow.from_page}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-primary shrink-0" />
                        <span className="text-xs font-medium truncate flex-1 max-w-[40%]" title={flow.to_page}>
                          {flow.to_page}
                        </span>
                        <Badge variant="secondary" className="text-[10px] h-5 px-1.5 shrink-0 ml-auto">
                          {flow.count.toLocaleString()}
                        </Badge>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          {/* Info Card */}
          <div className="bg-muted/30 p-4 rounded border border-border/50 flex gap-4">
            <Route className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="space-y-1">
              <p className="text-xs font-bold text-foreground">About Path Analysis</p>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                Path analysis shows how visitors navigate between pages on your website. Entry pages
                are the first pages visited in a session, exit pages are the last. Page flows show the
                most common transitions between any two pages. Use this data to optimize navigation
                and reduce friction in key user journeys.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
