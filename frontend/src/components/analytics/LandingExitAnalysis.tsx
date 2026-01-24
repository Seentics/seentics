'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LogIn, LogOut, ArrowRight, MousePointer2 } from 'lucide-react';

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
      <Card className="bg-card border shadow-sm dark:bg-gray-800 rounded-md overflow-hidden">
        <CardHeader className="border-b pb-4">
          <div className="h-5 w-40 bg-muted rounded animate-pulse" />
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-4 p-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-4 items-center">
                <div className="h-10 w-10 bg-muted rounded-lg animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-full bg-muted rounded animate-pulse" />
                  <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
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
      <div className="group relative flex items-center gap-4 p-3 hover:bg-muted/50 transition-all rounded-lg border border-transparent hover:border-border">
        <div className="flex-1 min-w-0 z-10">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-foreground truncate max-w-[180px]" title={item.page}>
              {item.page === '/' ? 'Homepage' : item.page}
            </p>
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              {item.sessions.toLocaleString()} sessions
            </span>
          </div>
          <div className="flex items-center gap-3">
             <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full transition-all duration-1000 ${isEntry ? 'bg-blue-500' : 'bg-rose-500'}`}
                  style={{ width: `${percentage}%` }}
                />
             </div>
             <span className={`text-[10px] font-bold shrink-0 ${isEntry ? 'text-blue-600 dark:text-blue-400' : 'text-rose-600 dark:text-rose-400'}`}>
               {item.rate}% {isEntry ? 'bounce' : 'exit'}
             </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <Tabs defaultValue="entry" className="w-full h-full">
      <Card className="bg-card border shadow-sm dark:bg-gray-800 rounded-md overflow-hidden flex flex-col h-full">
        <CardHeader className="bg-muted/10 pb-4 border-b">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold">Entry & Exit Points</CardTitle>
              <p className="text-xs text-muted-foreground whitespace-nowrap">Highest entry and exit points analysis</p>
            </div>
            
            <TabsList className="grid grid-cols-2 h-9 w-full sm:w-auto">
              <TabsTrigger 
                value="entry" 
                className="text-xs font-semibold px-4"
              >
                Entry Pages
              </TabsTrigger>
              <TabsTrigger 
                value="exit" 
                className="text-xs font-semibold px-4"
              >
                Exit Pages
              </TabsTrigger>
            </TabsList>
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1">
          <div className="p-4 flex-1">
            <TabsContent value="entry" className="mt-0 space-y-2 animate-in fade-in slide-in-from-left-4 duration-500">
              {entryPages.length > 0 ? entryPages.slice(0, 5).map((item, idx) => (
                <PageItem key={idx} item={item} index={idx} type="entry" maxSessions={maxEntrySessions} />
              )) : (
                <div className="h-64 flex flex-col items-center justify-center text-center space-y-2">
                  <div className="h-12 w-12 bg-muted rounded-full flex items-center justify-center">
                    <LogIn className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-xs font-semibold text-muted-foreground">No entry data detected</p>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="exit" className="mt-0 space-y-2 animate-in fade-in slide-in-from-right-4 duration-500">
              {exitPages.length > 0 ? exitPages.slice(0, 5).map((item, idx) => (
                <PageItem key={idx} item={item} index={idx} type="exit" maxSessions={maxExitSessions} />
              )) : (
                <div className="h-64 flex flex-col items-center justify-center text-center space-y-2">
                   <div className="h-12 w-12 bg-muted rounded-full flex items-center justify-center">
                    <LogOut className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-xs font-semibold text-muted-foreground">No exit data detected</p>
                </div>
              )}
            </TabsContent>
          </div>
        </CardContent>
      <div className="p-3 bg-muted/10 border-t text-center">
          <span className="text-xs font-medium text-muted-foreground">
            Analysis based on last 7 days behavioral data
          </span>
      </div>
     </Card>
    </Tabs>
  );
}
