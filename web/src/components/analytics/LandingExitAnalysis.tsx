'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogIn, LogOut, ArrowRight, MousePointer2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface PageStat {
  page: string;
  sessions: number;
  rate: number; 
}

interface LandingExitAnalysisProps {
  entryPages?: PageStat[];
  exitPages?: PageStat[];
  isLoading?: boolean;
}

export function LandingExitAnalysis({ entryPages = [], exitPages = [], isLoading }: LandingExitAnalysisProps) {
  if (isLoading) {
    return (
      <Card className="bg-card border-border shadow-sm shadow-black/5 rounded overflow-hidden flex flex-col h-full">
        <CardHeader className="pb-4 border-b border-border/40">
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-4 items-center">
                <Skeleton className="h-10 w-10 rounded" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const maxEntrySessions = Math.max(...entryPages.map(p => p.sessions), 1);
  const maxExitSessions = Math.max(...exitPages.map(p => p.sessions), 1);

  const PageItem = ({ item, index, type, maxSessions }: { item: PageStat, index: number, type: 'entry' | 'exit', maxSessions: number }) => {
    const percentage = (item.sessions / maxSessions) * 100;
    const isEntry = type === 'entry';
    
    return (
      <div className="group relative flex items-center gap-4 p-4 rounded border border-transparent transition-all duration-300 hover:bg-accent/5 hover:border-border/40">
        <div className="flex-1 min-w-0 z-10">
          <div className="flex items-center justify-between mb-2">
            <p className="font-bold text-[13px] leading-tight text-foreground truncate " title={item.page}>
              {item.page === '/' ? 'Homepage' : item.page}
            </p>
            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest opacity-60">
              {item.sessions.toLocaleString()} sessions
            </span>
          </div>
          <div className="flex items-center gap-4">
             <div className="h-1.5 flex-1 bg-accent/10 rounded-full overflow-hidden">
                <div 
                  className={cn(
                    "h-full rounded-full transition-all duration-1000",
                    isEntry ? 'bg-primary shadow-[0_0_8px_var(--primary)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.3)]'
                  )}
                  style={{ width: `${percentage}%` }}
                />
             </div>
             <span className={cn(
               "text-[10px] font-black uppercase tracking-widest whitespace-nowrap",
               isEntry ? 'text-primary' : 'text-rose-500'
             )}>
               {item.rate}% {isEntry ? 'bounce' : 'exit'}
             </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Tabs defaultValue="entry" className="w-full h-full">
      <Card className="bg-card border-border shadow-sm shadow-black/5 rounded overflow-hidden flex flex-col h-full">
        <CardHeader className="pb-6 border-b border-border/40">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div className="space-y-1">
              <CardTitle className="text-xl font-black tracking-tight">Traffic Flow Engine</CardTitle>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] opacity-60">Entry & Exit Behavior analysis</p>
            </div>
            
            <TabsList className="grid grid-cols-2 h-9 w-full sm:w-[240px] bg-accent/20 p-1 rounded">
              <TabsTrigger value="entry" className="text-[10px] font-bold uppercase tracking-widest rounded active:bg-background">Entry</TabsTrigger>
              <TabsTrigger value="exit" className="text-[10px] font-bold uppercase tracking-widest rounded active:bg-background">Exit</TabsTrigger>
            </TabsList>
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1">
          <div className="p-6 flex-1">
            <TabsContent value="entry" className="mt-0 space-y-1 animate-in fade-in slide-in-from-left-4 duration-500 outline-none">
              {entryPages.length > 0 ? entryPages.slice(0, 5).map((item, idx) => (
                <PageItem key={idx} item={item} index={idx} type="entry" maxSessions={maxEntrySessions} />
              )) : (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/40 bg-accent/5 rounded border border-dashed border-border/60">
                  <LogIn className="h-12 w-12 mb-4 opacity-10" />
                  <p className="text-[10px] font-bold uppercase tracking-widest">No entry data detected</p>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="exit" className="mt-0 space-y-1 animate-in fade-in slide-in-from-right-4 duration-500 outline-none">
              {exitPages.length > 0 ? exitPages.slice(0, 5).map((item, idx) => (
                <PageItem key={idx} item={item} index={idx} type="exit" maxSessions={maxExitSessions} />
              )) : (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/40 bg-accent/5 rounded border border-dashed border-border/60">
                  <LogOut className="h-12 w-12 mb-4 opacity-10" />
                  <p className="text-[10px] font-bold uppercase tracking-widest">No exit data detected</p>
                </div>
              )}
            </TabsContent>
          </div>
        </CardContent>
        <div className="p-4 bg-accent/5 border-t border-border/40 text-center">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">
              Analysis calibrated on 7-day rolling window
            </span>
        </div>
      </Card>
    </Tabs>
  );
}
