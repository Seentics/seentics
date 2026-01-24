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
  
  return '/images/monitor.png'; // Fallback for screens
};

export function TopDevicesChart({ data, osData, screenData, isLoading }: TopDevicesChartProps) {
  const [activeTab, setActiveTab] = useState('devices');

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center justify-between p-3 border-b animate-pulse">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-muted rounded-md" />
              <div className="h-4 w-24 bg-muted rounded" />
            </div>
            <div className="h-4 w-12 bg-muted rounded" />
          </div>
        ))}
      </div>
    );
  }

  const PageList = ({ items, type }: { items: any[], type: 'device' | 'os' | 'screen' }) => {
    if (!items || items.length === 0) {
      // Mock screen data if none provided
      const displayItems = type === 'screen' ? [
        { name: '1920x1080', value: 4500 },
        { name: '1366x768', value: 3200 },
        { name: '375x812', value: 2800 },
        { name: '1440x900', value: 2100 },
        { name: '414x896', value: 1500 }
      ] : items;

      if (!displayItems || displayItems.length === 0) {
        return (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground opacity-50">
            <Layers className="h-10 w-10 mb-2" />
            <p className="text-sm">No data available</p>
          </div>
        );
      }
      return <PageList items={displayItems} type={type} />;
    }

    const sortedItems = [...items].sort((a, b) => {
      const valA = a.visitors || a.views || a.value || 0;
      const valB = b.visitors || b.views || b.value || 0;
      return valB - valA;
    }).slice(0, 8);

    return (
      <div className="space-y-0">
        {sortedItems.map((item, index) => {
          const val = item.visitors || item.views || item.value || 0;
          const label = item.device || item.os || item.name || 'Unknown';
          const img = getSystemImage(label, type);

          return (
            <div key={index} className="flex items-center justify-between p-2 py-3 border-b transition-all hover:bg-gray-50/50 dark:hover:bg-gray-800/20">
              <div className="flex items-center space-x-4 flex-1 min-w-0">
                <div className="flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center shadow-sm overflow-hidden p-1.5 transition-transform hover:scale-110">
                  <Image
                    src={img}
                    alt={label}
                    width={16}
                    height={16}
                    className="object-contain"
                    onError={(e) => {
                      const target = e.target as HTMLElement;
                      target.style.display = 'none';
                      target.nextElementSibling?.classList.remove('hidden');
                    }}
                  />
                  <Globe className="h-4 w-4 text-muted-foreground hidden" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm text-foreground truncate">{label}</div>
                  <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest truncate">
                    {type === 'device' ? 'Hardware' : type === 'os' ? 'Software' : 'Resolution'} Insight
                  </div>
                </div>
              </div>

              <div className="shrink-0 text-right">
                <div className="text-right">
                  <div className="font-bold text-base leading-tight">
                    {formatNumber(val)}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
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
    <div className="flex flex-col h-full">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
           <div>
              <CardTitle className="text-base font-semibold">System Insights</CardTitle>
              <p className="text-xs text-muted-foreground">Devices, OS, and Screen Resolutions</p>
           </div>
           <TabsList className="grid grid-cols-3 h-9 w-full sm:w-auto p-1">
             <TabsTrigger value="devices" className="text-xs font-semibold px-4">Devices</TabsTrigger>
             <TabsTrigger value="os" className="text-xs font-semibold px-4">OS</TabsTrigger>
             <TabsTrigger value="screens" className="text-xs font-semibold px-4">Screens</TabsTrigger>
           </TabsList>
        </div>
        
        <TabsContent value="devices" className="mt-0 focus-visible:outline-none">
          <PageList items={data?.top_devices || []} type="device" />
        </TabsContent>
        <TabsContent value="os" className="mt-0 focus-visible:outline-none">
          <PageList items={osData?.top_os || []} type="os" />
        </TabsContent>
        <TabsContent value="screens" className="mt-0 focus-visible:outline-none">
          <PageList items={screenData} type="screen" />
        </TabsContent>
      </Tabs>
    </div>
  );
}