'use client';

import {
  Layers,
  Globe,
  HelpCircle
} from 'lucide-react';
import Image from 'next/image';


import { formatNumber } from '@/features/analytics/format';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

import { cn } from '@/lib/utils';
import { getBrowserImagePath, getDeviceImagePath, getOsImagePath } from '@/lib/analytics-icons';
import { useControllableState } from '@/hooks/useControllableState';

interface TopDevicesChartProps {
  data?: any; // { top_devices: [] }
  osData?: any; // { top_os: [] }
  browserData?: any; // { top_browsers: [] }
  isLoading?: boolean;
  onFilter?: (filter: Record<string, string>) => void;
  /** Optional controlled tab for deterministic recorded states. */
  activeTab?: 'os' | 'devices' | 'browsers';
  onActiveTabChange?: (tab: 'os' | 'devices' | 'browsers') => void;
}

const getSystemImage = (label: string, type: 'device' | 'os') => {
  if (type === 'device') return getDeviceImagePath(label);
  return getOsImagePath(label);
};

export function TopDevicesChart({ data, osData, browserData, isLoading, onFilter, activeTab, onActiveTabChange }: TopDevicesChartProps) {
  const [selectedTab, handleTabChange] = useControllableState({
    value: activeTab,
    defaultValue: 'os' as const,
    onChange: onActiveTabChange,
  });

  if (isLoading) {
    return (
      <div className="space-y-4 h-[420px]">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center justify-between p-3 border-b animate-pulse">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-muted rounded-lg" />
              <div className="h-4 w-24 bg-muted rounded-lg" />
            </div>
            <div className="h-4 w-12 bg-muted rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  const PageList = ({ items, type }: { items: any[], type: 'device' | 'os' | 'browser' }) => {
    let displayItems = items;
    
    // Support the wrapper object format if provided
    if (type === 'browser' && items && (items as any).top_browsers) {
      displayItems = (items as any).top_browsers;
    }

    if (!displayItems || displayItems.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/40 bg-accent/5 rounded-lg border border-dashed border-border">
          <Layers className="h-10 w-10 mb-2 opacity-20" />
          <p className="text-xs font-medium text-muted-foreground">No data available</p>
        </div>
      );
    }

    const sortedItems = [...displayItems].sort((a, b) => {
      const valA = a.visitors || a.views || a.value || a.count || 0;
      const valB = b.visitors || b.views || b.value || b.count || 0;
      return valB - valA;
    }).slice(0, 30);
    const maxVal = Math.max(...sortedItems.map((i) => i.visitors || i.views || i.value || i.count || 0), 1);

    return (
      <div className="mt-2">
        {sortedItems.map((item, index) => {
          const val = item.visitors || item.views || item.value || item.count || 0;
          const label = item.device || item.os || item.browser || item.name || 'Unknown';
          const img = type === 'browser' ? getBrowserImagePath(label) : getSystemImage(label, type);

          const handleClick = () => {
            if (!onFilter) return;
            if (type === 'device') onFilter({ device: label });
            else if (type === 'os') onFilter({ os: label });
            else if (type === 'browser') onFilter({ browser: label });
          };

          return (
            <div key={index} className={cn("relative flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-accent/10 transition-colors group", onFilter && "cursor-pointer")} onClick={handleClick}>
              <div
                className="absolute inset-y-0.5 left-0 rounded-md bg-primary/10"
                style={{ width: `${Math.max(2, (val / maxVal) * 100)}%` }}
              />
              <div className="relative flex items-center gap-2 flex-1 min-w-0">
                <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center overflow-hidden">
                  {label === 'Unknown' ? (
                    <HelpCircle className="h-4 w-4 text-muted-foreground/50" />
                  ) : (
                    <>
                      <Image
                        src={img}
                        alt=""
                        aria-hidden="true"
                        width={20}
                        height={20}
                        className="h-4 w-4 object-contain"
                        onError={(e) => {
                          const target = e.target as HTMLElement;
                          target.style.display = 'none';
                          target.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                      <Globe className="h-4 w-4 text-primary hidden" />
                    </>
                  )}
                </div>
                <span className="truncate text-[13px] font-medium text-foreground group-hover:text-primary transition-colors">{label}</span>
              </div>

              <div className="relative shrink-0 text-right text-[13px] font-semibold tabular-nums">
                {formatNumber(val)}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col">
      <Tabs value={selectedTab} onValueChange={(value) => handleTabChange(value as 'os' | 'devices' | 'browsers')} className="flex-1 flex flex-col min-h-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border shrink-0">
           <h3 className="text-sm font-semibold tracking-tight">System Insights</h3>
           <TabsList className="grid grid-cols-3 h-8 w-full sm:w-[220px] bg-muted p-0.5 rounded-lg shrink-0">
             <TabsTrigger value="os" className="h-7 text-xs font-medium rounded-lg data-[state=inactive]:text-muted-foreground data-[state=inactive]:bg-transparent data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">OS</TabsTrigger>
             <TabsTrigger value="devices" className="h-7 text-xs font-medium rounded-lg data-[state=inactive]:text-muted-foreground data-[state=inactive]:bg-transparent data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">Devices</TabsTrigger>
             <TabsTrigger value="browsers" className="h-7 text-xs font-medium rounded-lg data-[state=inactive]:text-muted-foreground data-[state=inactive]:bg-transparent data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">Browsers</TabsTrigger>
           </TabsList>
        </div>
        
        <TabsContent value="devices" className="mt-0 focus-visible:outline-none focus:outline-none flex-1 min-h-0 overflow-hidden">
          <div className="max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
            <PageList items={data?.top_devices || []} type="device" />
          </div>
        </TabsContent>
        <TabsContent value="os" className="mt-0 focus-visible:outline-none focus:outline-none flex-1 min-h-0 overflow-hidden">
          <div className="max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
            <PageList items={osData?.top_os || []} type="os" />
          </div>
        </TabsContent>
        <TabsContent value="browsers" className="mt-0 focus-visible:outline-none focus:outline-none flex-1 min-h-0 overflow-hidden">
          <div className="max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
            <PageList items={browserData} type="browser" />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
