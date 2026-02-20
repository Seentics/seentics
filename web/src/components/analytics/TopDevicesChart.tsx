'use client';

import { 
  Monitor, 
  Smartphone, 
  Tablet, 
  Laptop, 
  Tv, 
  Box, 
  Layers, 
  Cpu, 
  Maximize,
  Globe
} from 'lucide-react';
import Image from 'next/image';
import React, { useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatNumber } from '@/lib/analytics-api';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface TopDevicesChartProps {
  data?: any; // { top_devices: [] }
  osData?: any; // { top_os: [] }
  screenData?: any; // Optional screen data
  isLoading?: boolean;
}

const getSystemImage = (label: string, type: 'device' | 'os' | 'screen') => {
  const lower = label.toLowerCase();
  
  if (type === 'device') {
    if (lower.includes('mobile') || lower.includes('phone')) return '/images/phone.png';
    if (lower.includes('tablet')) return '/images/tablet.png';
    if (lower.includes('desktop') || lower.includes('pc') || lower.includes('laptop')) return '/images/monitor.png';
    return '/images/monitor.png';
  }
  
  if (type === 'os') {
    if (lower.includes('windows')) return '/images/windows.png';
    if (lower.includes('mac') || lower.includes('ios') || lower.includes('apple')) return '/images/apple.png';
    if (lower.includes('android')) return '/images/android.png';
    if (lower.includes('linux')) return '/images/linux.png';
    return '/images/planet-earth.png';
  }
  
  return '/images/monitor.png';
};

export function TopDevicesChart({ data, osData, screenData, isLoading }: TopDevicesChartProps) {
  const [activeTab, setActiveTab] = useState('devices');

  if (isLoading) {
    return (
      <div className="space-y-4 h-[400px]">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center justify-between p-3 border-b animate-pulse">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-muted rounded" />
              <div className="h-4 w-24 bg-muted rounded" />
            </div>
            <div className="h-4 w-12 bg-muted rounded" />
          </div>
        ))}
      </div>
    );
  }

  const PageList = ({ items, type }: { items: any[], type: 'device' | 'os' | 'screen' }) => {
    // If we have screenData from props, use it
    let displayItems = items;
    
    // Support the wrapper object format if provided
    if (type === 'screen' && items && (items as any).top_resolutions) {
      displayItems = (items as any).top_resolutions;
    }

    if (!displayItems || displayItems.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/40 bg-accent/5 rounded border border-dashed border-border/60">
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
          const label = item.device || item.os || item.name || 'Unknown';
          const img = getSystemImage(label, type);

          return (
            <div key={index} className="flex items-center justify-between py-3 border-b border-border/40 last:border-0 hover:bg-accent/5 transition-colors group px-1">
              <div className="flex items-center space-x-4 flex-1 min-w-0">
                <div className="flex-shrink-0 w-10 h-10 rounded bg-accent/10 flex items-center justify-center shadow-sm overflow-hidden p-1.5 group-hover:bg-primary/10 transition-colors">
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
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-sm leading-tight text-foreground truncate group-hover:text-primary transition-colors">{label}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {type === 'device' ? 'Hardware' : type === 'os' ? 'Software' : 'Resolution'}
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
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-border/40 shrink-0">
           <div className="space-y-1">
              <CardTitle className="text-lg font-bold tracking-tight">System Insights</CardTitle>
              <p className="text-xs text-muted-foreground">Devices, OS & tech specs</p>
           </div>
           <TabsList className="grid grid-cols-3 h-9 w-full sm:w-[240px] bg-accent/10 p-1 rounded shrink-0">
             <TabsTrigger value="devices" className="text-xs font-medium rounded active:bg-background">Devices</TabsTrigger>
             <TabsTrigger value="os" className="text-xs font-medium rounded active:bg-background">OS</TabsTrigger>
             <TabsTrigger value="screens" className="text-xs font-medium rounded active:bg-background">Screens</TabsTrigger>
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
        <TabsContent value="screens" className="mt-0 focus-visible:outline-none focus:outline-none flex-1 min-h-0 overflow-hidden">
          <div className="h-full overflow-y-auto pr-1 custom-scrollbar">
            <PageList items={screenData} type="screen" />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}