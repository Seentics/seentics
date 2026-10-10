'use client';


import { formatNumber } from '@/features/analytics/format';
import { BarChart3, CreditCard, DollarSign, FileText, Globe, Home, Info, LogIn, Package, Phone, Settings, Shield, ShoppingCart, Users, Workflow, Zap } from 'lucide-react';
import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useControllableState } from '@/hooks/useControllableState';

export interface TopPagesChartProps {
  data: any; // Top pages data: { top_pages: [] }
  entryPages?: any[]; // { page, sessions, bounce_rate }
  exitPages?: any[]; // { page, sessions, exit_rate }
  isLoading: boolean;
  onFilter?: (filter: Record<string, string>) => void;
  /** Optional controlled tab for replayable product demos and embedded screens. */
  activeTab?: 'top' | 'entry' | 'exit';
  onActiveTabChange?: (tab: 'top' | 'entry' | 'exit') => void;
}

const getPageIcon = (page: string) => {
  if (!page) return <Globe className="w-4 h-4 text-gray-500" />;
  const path = getPathFromUrl(page).toLowerCase();

  if (path === '/') return <Home className="w-4 h-4 text-indigo-500" />;

  // App-specific paths
  if (path.includes('/heatmaps')) return <Zap className="w-4 h-4 text-orange-500" />;
  if (path.includes('/replays')) return <Workflow className="w-4 h-4 text-purple-500" />;
  if (path.includes('/funnels')) return <Workflow className="w-4 h-4 text-indigo-500" />;
  if (path.includes('/automations')) return <Zap className="w-4 h-4 text-yellow-500" />;
  if (path.includes('/revenue')) return <DollarSign className="w-4 h-4 text-green-600" />;
  if (path.includes('/dashboard')) return <BarChart3 className="w-4 h-4 text-indigo-500" />;
  if (path.includes('/admin')) return <Shield className="w-4 h-4 text-red-500" />;
  if (path.includes('/websites')) return <Globe className="w-4 h-4 text-indigo-500" />;
  if (path.includes('/billing') || path.includes('/subscriptions')) return <CreditCard className="w-4 h-4 text-indigo-500" />;
  if (path.includes('/team')) return <Users className="w-4 h-4 text-blue-500" />;
  if (path.includes('/users')) return <Users className="w-4 h-4 text-blue-500" />;
  if (path.includes('/storage')) return <Package className="w-4 h-4 text-gray-500" />;

  // Generic patterns
  if (path.includes('/blog') || path.includes('/post')) return <FileText className="w-4 h-4 text-green-500" />;
  if (path.includes('/about')) return <Info className="w-4 h-4 text-indigo-500" />;
  if (path.includes('/contact')) return <Phone className="w-4 h-4 text-orange-500" />;
  if (path.includes('/pricing')) return <DollarSign className="w-4 h-4 text-yellow-500" />;
  if (path.includes('/products') || path.includes('/product/')) return <Package className="w-4 h-4 text-indigo-500" />;
  if (path.includes('/analytics')) return <BarChart3 className="w-4 h-4 text-indigo-500" />;
  if (path.includes('/auth') || path.includes('/login')) return <LogIn className="w-4 h-4 text-gray-500" />;
  if (path.includes('/settings')) return <Settings className="w-4 h-4 text-gray-600" />;
  if (path.includes('/cart')) return <ShoppingCart className="w-4 h-4 text-indigo-600" />;

  return <Globe className="w-4 h-4 text-indigo-500" />;
};

const uuidSegRe =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const getPageName = (page: string) => {
  if (!page) return 'Unknown Page';
  const path = getPathFromUrl(page);
  if (path === '/') return 'Homepage';

  const segments = path.split('/').filter(Boolean);
  if (segments.length > 0) {
    const lastSegment = segments[segments.length - 1];
    if (segments[0] === 'websites' && uuidSegRe.test(lastSegment)) {
      return 'Website dashboard';
    }
    if (uuidSegRe.test(lastSegment)) {
      return 'Page';
    }
    return lastSegment.split(/[-_]/).map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }
  return path;
};

const getPathFromUrl = (url: string) => {
  if (!url) return '/';
  try {
    const urlObj = new URL(url);
    return urlObj.pathname;
  } catch {
    return url.split('?')[0];
  }
};

const truncatePath = (path: string, maxLength: number = 30) => {
  if (path.length <= maxLength) return path;
  return path.substring(0, maxLength / 2) + '...' + path.substring(path.length - maxLength / 2);
};

export const TopPagesChart: React.FC<TopPagesChartProps> = ({
  data,
  entryPages = [],
  exitPages = [],
  isLoading,
  onFilter,
  activeTab,
  onActiveTabChange,
}) => {
  const [selectedTab, handleTabChange] = useControllableState({
    value: activeTab,
    defaultValue: 'top' as const,
    onChange: onActiveTabChange,
  });

  if (isLoading) {
    return (
      <div className="space-y-4 h-[420px]">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center justify-between p-3 border-b animate-pulse text-muted">
             <div className="flex items-center space-x-4 flex-1">
                <div className="w-4 h-4 bg-muted rounded-lg" />
                <div className="space-y-2">
                   <div className="h-4 w-32 bg-muted rounded-lg" />
                   <div className="h-3 w-20 bg-muted rounded-lg" />
                </div>
             </div>
             <div className="h-8 w-16 bg-muted rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  const PageList = ({ items, type }: { items: any[], type: 'top' | 'entry' | 'exit' }) => {
    if (items.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/40 bg-accent/5 rounded-lg border border-dashed border-border">
          <FileText className="h-10 w-10 mb-2 opacity-20" />
          <p className="text-xs font-medium text-muted-foreground/60">No page data</p>
        </div>
      );
    }

    const sortedItems = [...items].sort((a, b) => (b.views || b.sessions || 0) - (a.views || a.sessions || 0)).slice(0, 30);
    const maxVal = Math.max(...sortedItems.map(item => item.views || item.sessions || 1));

    return (
      <div className="mt-2">
        {sortedItems.map((item, index) => {
          const val = item.views || item.sessions || 0;
          const name = getPageName(item.page);
          const path = getPathFromUrl(item.page);
          const secondaryMetric = type === 'top' ? null : item.bounce_rate !== undefined ? `${item.bounce_rate}% bounce` : item.exit_rate !== undefined ? `${item.exit_rate}% exit` : null;

          return (
            <div key={index} className={cn("relative flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-accent/10 transition-colors group", onFilter && "cursor-pointer")} onClick={() => onFilter?.({ page_path: path })}>
              <div
                className="absolute inset-y-0.5 left-0 rounded-md bg-primary/10"
                style={{ width: `${Math.max(2, (val / maxVal) * 100)}%` }}
              />
              <div className="relative flex min-w-0 flex-1 items-center gap-2">
                <span className="shrink-0 [&>svg]:h-3.5 [&>svg]:w-3.5">{getPageIcon(item.page)}</span>
                <span className="truncate text-[13px] font-medium text-foreground group-hover:text-primary transition-colors" title={path}>
                  {name}
                </span>
                <span className="hidden truncate text-[11px] text-muted-foreground/60 sm:inline" title={path}>
                  {truncatePath(path)}
                </span>
              </div>

              <div className="relative shrink-0 text-right text-[13px] tabular-nums">
                <span className="font-semibold">{formatNumber(val)}</span>
                {secondaryMetric && <span className="ml-2 text-[11px] text-muted-foreground">{secondaryMetric}</span>}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col">
      <Tabs value={selectedTab} onValueChange={(value) => handleTabChange(value as 'top' | 'entry' | 'exit')} className="flex-1 flex flex-col min-h-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border shrink-0">
           <h3 className="text-sm font-semibold tracking-tight">Top Pages</h3>
           <TabsList className="grid grid-cols-3 h-8 w-full sm:w-[240px] bg-muted p-0.5 rounded-lg shrink-0">
             <TabsTrigger value="top" className="h-7 text-xs font-medium rounded-lg data-[state=inactive]:text-muted-foreground data-[state=inactive]:bg-transparent data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">Top</TabsTrigger>
             <TabsTrigger value="entry" className="h-7 text-xs font-medium rounded-lg data-[state=inactive]:text-muted-foreground data-[state=inactive]:bg-transparent data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">Entry</TabsTrigger>
             <TabsTrigger value="exit" className="h-7 text-xs font-medium rounded-lg data-[state=inactive]:text-muted-foreground data-[state=inactive]:bg-transparent data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">Exit</TabsTrigger>
           </TabsList>
        </div>
        
        <TabsContent value="top" className="mt-0 focus-visible:outline-none focus:outline-none flex-1 min-h-0 overflow-hidden">
          <div className="max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
            <PageList items={data?.top_pages || []} type="top" />
          </div>
        </TabsContent>
        <TabsContent value="entry" className="mt-0 focus-visible:outline-none focus:outline-none flex-1 min-h-0 overflow-hidden">
          <div className="max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
            <PageList items={entryPages} type="entry" />
          </div>
        </TabsContent>
        <TabsContent value="exit" className="mt-0 focus-visible:outline-none focus:outline-none flex-1 min-h-0 overflow-hidden">
          <div className="max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
            <PageList items={exitPages} type="exit" />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};


import { cn } from '@/lib/utils';
