'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { formatNumber } from '@/lib/analytics-api';
import { 
  BarChart3, 
  Calendar, 
  CreditCard, 
  DollarSign, 
  FileText, 
  Globe, 
  HelpCircle, 
  Home, 
  Info, 
  LogIn, 
  LogOut,
  Mail, 
  Package, 
  Palette, 
  Phone, 
  Settings, 
  Shield, 
  ShoppingCart, 
  User, 
  Users, 
  Workflow, 
  Zap,
  ChevronRight
} from 'lucide-react';
import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface TopPagesChartProps {
  data: any; // Top pages data: { top_pages: [] }
  entryPages?: any[]; // { page, sessions, bounce_rate }
  exitPages?: any[]; // { page, sessions, exit_rate }
  isLoading: boolean;
  onViewMore?: () => void;
  showHeader?: boolean;
}

const getPageIcon = (page: string) => {
  if (!page) return <Globe className="w-4 h-4 text-gray-500" />;
  const path = getPathFromUrl(page).toLowerCase();

  if (path === '/') return <Home className="w-4 h-4 text-blue-500" />;
  if (path.includes('/blog') || path.includes('/post')) return <FileText className="w-4 h-4 text-green-500" />;
  if (path.includes('/about')) return <Info className="w-4 h-4 text-purple-500" />;
  if (path.includes('/contact')) return <Phone className="w-4 h-4 text-orange-500" />;
  if (path.includes('/pricing')) return <DollarSign className="w-4 h-4 text-yellow-500" />;
  if (path.includes('/products') || path.includes('/product/')) return <Package className="w-4 h-4 text-indigo-500" />;
  if (path.includes('/analytics')) return <BarChart3 className="w-4 h-4 text-blue-500" />;
  if (path.includes('/auth') || path.includes('/login')) return <LogIn className="w-4 h-4 text-gray-500" />;
  if (path.includes('/settings')) return <Settings className="w-4 h-4 text-gray-600" />;
  if (path.includes('/cart')) return <ShoppingCart className="w-4 h-4 text-blue-600" />;
  
  return <Globe className="w-4 h-4 text-purple-500" />;
};

const getPageName = (page: string) => {
  if (!page) return 'Unknown Page';
  const path = getPathFromUrl(page);
  if (path === '/') return 'Homepage';
  
  const segments = path.split('/').filter(Boolean);
  if (segments.length > 0) {
    const lastSegment = segments[segments.length - 1];
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
  onViewMore, 
  showHeader = false 
}) => {
  const [activeTab, setActiveTab] = useState('top');

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center justify-between p-3 border-b animate-pulse text-muted">
             <div className="flex items-center space-x-4 flex-1">
                <div className="w-4 h-4 bg-muted rounded" />
                <div className="space-y-2">
                   <div className="h-4 w-32 bg-muted rounded" />
                   <div className="h-3 w-20 bg-muted rounded" />
                </div>
             </div>
             <div className="h-8 w-16 bg-muted rounded" />
          </div>
        ))}
      </div>
    );
  }

  const PageList = ({ items, type }: { items: any[], type: 'top' | 'entry' | 'exit' }) => {
    if (items.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/40 bg-accent/5 rounded border border-dashed border-border/60">
          <FileText className="h-10 w-10 mb-2 opacity-20" />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">No page data</p>
        </div>
      );
    }

    const sortedItems = [...items].sort((a, b) => (b.views || b.sessions || 0) - (a.views || a.sessions || 0)).slice(0, 8);
    const maxVal = Math.max(...sortedItems.map(item => item.views || item.sessions || 1));

    return (
      <div className="space-y-2 mt-4">
        {sortedItems.map((item, index) => {
          const val = item.views || item.sessions || 0;
          const percentage = ((val / maxVal) * 100).toFixed(1);
          const name = getPageName(item.page);
          const path = getPathFromUrl(item.page);
          const secondaryMetric = type === 'top' ? null : item.bounce_rate !== undefined ? `${item.bounce_rate}% bounce` : item.exit_rate !== undefined ? `${item.exit_rate}% exit` : null;

          return (
            <div key={index} className="flex items-center justify-between p-3 rounded border border-transparent transition-all duration-300 hover:bg-accent/5 hover:border-border/40 group">
              <div className="flex items-center space-x-4 flex-1 min-w-0">
                <div className="flex-shrink-0 p-2 bg-accent/10 rounded group-hover:bg-primary/10 transition-colors">
                  {getPageIcon(item.page)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm leading-tight text-foreground truncate group-hover:text-primary transition-colors" title={name}>
                    {name}
                  </div>
                  <div className="text-[10px] text-muted-foreground font-medium truncate opacity-50" title={path}>
                    {truncatePath(path)}
                  </div>
                </div>
              </div>

              <div className="shrink-0 text-right">
                <div className="text-right">
                  <div className="font-bold text-base leading-tight tracking-tight">
                    {formatNumber(val)}
                  </div>
                  <div className="text-[9px] text-muted-foreground uppercase font-semibold tracking-wider opacity-50">
                    {secondaryMetric || (type === 'top' ? 'Views' : 'Sessions')}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-border/40">
             <div className="space-y-1">
                <CardTitle className="text-lg font-bold tracking-tight">Top Pages</CardTitle>
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest opacity-50">Most visited & landing destinations</p>
             </div>
             <TabsList className="grid grid-cols-3 h-9 w-full sm:w-[240px] bg-accent/10 p-1 rounded">
               <TabsTrigger value="top" className="text-[10px] font-semibold uppercase tracking-wider rounded active:bg-background">Top</TabsTrigger>
               <TabsTrigger value="entry" className="text-[10px] font-semibold uppercase tracking-wider rounded active:bg-background">Entry</TabsTrigger>
               <TabsTrigger value="exit" className="text-[10px] font-semibold uppercase tracking-wider rounded active:bg-background">Exit</TabsTrigger>
             </TabsList>
          </div>
          
          <TabsContent value="top" className="mt-0 focus-visible:outline-none focus:outline-none">
            <PageList items={data?.top_pages || []} type="top" />
          </TabsContent>
          <TabsContent value="entry" className="mt-0 focus-visible:outline-none focus:outline-none">
            <PageList items={entryPages} type="entry" />
          </TabsContent>
          <TabsContent value="exit" className="mt-0 focus-visible:outline-none focus:outline-none">
            <PageList items={exitPages} type="exit" />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

import { CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';