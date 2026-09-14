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
      <div className="space-y-4 h-[400px]">
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

    return (
      <div className="space-y-0 mt-4">
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
            <div key={index} className={cn("flex items-center justify-between py-3 border-b border-border last:border-0 hover:bg-accent/5 transition-colors group px-1", onFilter && "cursor-pointer")} onClick={handleClick}>
              <div className="flex items-center space-x-4 flex-1 min-w-0">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shadow-sm overflow-hidden p-1.5 group-hover:bg-primary/10 transition-colors">
                  {label === 'Unknown' ? (
                    <HelpCircle className="h-5 w-5 text-muted-foreground/50" />
                  ) : (
                    <>
                      <Image
                        src={img}
                        alt=""
                        aria-hidden="true"
                        width={20}
                        height={20}
                        className="object-contain"
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
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm leading-tight text-foreground truncate group-hover:text-primary transition-colors">{label}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {type === 'device' ? 'Hardware' : type === 'os' ? 'Software' : 'Browser'}
                  </div>
                </div>
              </div>

              <div className="shrink-0 text-right">
                <div className="text-right">
                  <div className="font-bold text-base leading-tight tracking-tight">
                    {formatNumber(val)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Visitors
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
    <div className="h-[400px] flex flex-col">
      <Tabs value={selectedTab} onValueChange={(value) => handleTabChange(value as 'os' | 'devices' | 'browsers')} className="flex-1 flex flex-col min-h-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border shrink-0">
           <div>
              <h3 className="text-base font-semibold tracking-tight">System Insights</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Devices, OS & tech specs</p>
           </div>
           <TabsList className="grid grid-cols-3 h-8 w-full sm:w-[220px] bg-muted/50 p-0.5 rounded-lg shrink-0">
             <TabsTrigger value="os" className="h-7 text-xs font-medium rounded-lg data-[state=inactive]:text-muted-foreground data-[state=inactive]:bg-transparent data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">OS</TabsTrigger>
             <TabsTrigger value="devices" className="h-7 text-xs font-medium rounded-lg data-[state=inactive]:text-muted-foreground data-[state=inactive]:bg-transparent data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">Devices</TabsTrigger>
             <TabsTrigger value="browsers" className="h-7 text-xs font-medium rounded-lg data-[state=inactive]:text-muted-foreground data-[state=inactive]:bg-transparent data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">Browsers</TabsTrigger>
           </TabsList>
        </div>
        
        <TabsContent value="devices" className="mt-0 focus-visible:outline-none focus:outline-none flex-1 min-h-0 overflow-hidden">
          <div className="h-full overflow-y-auto pr-1 custom-scrollbar">
            <PageList items={data?.top_devices || []} type="device" />
          </div>
        </TabsContent>
        <TabsContent value="os" className="mt-0 focus-visible:outline-none focus:outline-none flex-1 min-h-0 overflow-hidden">
          <div className="h-full overflow-y-auto pr-1 custom-scrollbar">
            <PageList items={osData?.top_os || []} type="os" />
          </div>
        </TabsContent>
        <TabsContent value="browsers" className="mt-0 focus-visible:outline-none focus:outline-none flex-1 min-h-0 overflow-hidden">
          <div className="h-full overflow-y-auto pr-1 custom-scrollbar">
            <PageList items={browserData} type="browser" />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
