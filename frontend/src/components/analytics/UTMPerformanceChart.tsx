'use client';

import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Target, TrendingUp, Info, Layers, Globe } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/analytics-api';

interface UTMPerformanceData {
  sources: Array<{
    source: string;
    unique_visitors: number;
    visits: number;
  }>;
  mediums: Array<{
    medium: string;
    unique_visitors: number;
    visits: number;
  }>;
  campaigns: Array<{
    campaign: string;
    unique_visitors: number;
    visits: number;
  }>;
  terms: Array<{
    term: string;
    unique_visitors: number;
    visits: number;
  }>;
  content: Array<{
    content: string;
    unique_visitors: number;
    visits: number;
  }>;
  avg_ctr: number;
  total_campaigns: number;
  total_sources: number;
  total_mediums: number;
}

interface UTMPerformanceChartProps {
  data: UTMPerformanceData;
  isLoading?: boolean;
  controlledTab?: 'sources' | 'mediums' | 'campaigns' | 'terms' | 'content';
  onTabChange?: (tab: 'sources' | 'mediums' | 'campaigns' | 'terms' | 'content') => void;
  hideTabs?: boolean;
}

export function UTMPerformanceChart({ data, isLoading = false, controlledTab, onTabChange, hideTabs = false }: UTMPerformanceChartProps) {
  const [internalTab, setInternalTab] = useState<'sources' | 'mediums' | 'campaigns' | 'terms' | 'content'>('sources');
  const utmTab = controlledTab ?? internalTab;
  
  if (isLoading) {
    return (
      <div className="space-y-2 mt-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center justify-between p-3 rounded border border-border/20 animate-pulse">
            <div className="flex items-center space-x-4">
              <Skeleton className="w-10 h-10 rounded" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
            </div>
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
    );
  }

  const getListData = (utmType: string) => {
    const utmData = data[utmType as keyof UTMPerformanceData] as Array<any>;
    if (!utmData || !Array.isArray(utmData)) return [] as Array<{ name: string; visitors: number; events: number }>;
    
    return utmData
      .map((item: any) => ({
        name: (item.source || item.medium || item.campaign || item.term || item.content || 'Unknown') === 'None' ? 'Direct' : (item.source || item.medium || item.campaign || item.term || item.content || 'Unknown'),
        visitors: Number(item.unique_visitors) || 0,
        events: Number(item.visits || item.pageviews || 0),
      }))
      .sort((a, b) => b.visitors - a.visitors);
  };

  const listData = getListData(utmTab).slice(0, 8);

  if (!data || listData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/40 bg-accent/5 rounded border border-dashed border-border/60">
        <Layers className="h-16 w-16 mb-4 opacity-10" />
        <div className="text-sm font-black uppercase tracking-[0.2em] mb-2">No Campaign Data</div>
        <div className="text-xs italic opacity-60 text-center px-8">Campaign performance will scale with your marketing efforts</div>
      </div>
    );
  }

  return (
    <div className="space-y-2  animate-in fade-in duration-500">
      {listData.map((item, idx) => (
        <div key={idx} className="flex items-center justify-between p-3 border-b transition-all duration-300 hover:bg-accent/5 hover:border-border/40 group">
          <div className="flex items-center space-x-4 flex-1 min-w-0">
            <div className="w-10 h-10 rounded bg-accent/10 flex items-center justify-center shadow-sm shrink-0 overflow-hidden p-1.5 group-hover:bg-primary/10 transition-colors">
              <Image 
                src={getImageForName(item.name, utmTab)} 
                alt={item.name} 
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
              <div className="font-bold text-[13px] leading-tight text-foreground truncate group-hover:text-primary transition-colors" title={item.name}>
                {item.name}
              </div>
              <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest opacity-60 truncate">
                {utmTab.slice(0, -1)} Analytics
              </div>
            </div>
          </div>

          <div className="shrink-0 text-right">
            <div className="text-right">
              <div className="font-black text-base leading-tight">
                {formatNumber(item.visitors)}
              </div>
              <div className="text-[9px] text-muted-foreground uppercase font-black tracking-[0.15em] opacity-60">
                Visitors
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

const getImageForName = (name: string, tab: string) => {
  const lower = (name || '').toLowerCase();
  if (lower.includes('google')) return '/images/search.png';
  if (lower.includes('facebook')) return '/images/facebook.png';
  if (lower.includes('twitter') || lower.includes('x.com')) return '/images/twitter.png';
  if (lower.includes('linkedin')) return '/images/linkedin.png';
  if (lower.includes('instagram')) return '/images/instagram.png';
  if (lower.includes('youtube')) return '/images/search.png';
  if (lower.includes('tiktok')) return '/images/tiktok.png';
  if (lower.includes('pinterest')) return '/images/pinterest.png';
  if (lower.includes('email') || lower.includes('mail')) return '/images/search.png';
  if (lower.includes('direct')) return '/images/link.png';
  return '/images/planet-earth.png';
};
