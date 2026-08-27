'use client';

import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Layers, Globe } from 'lucide-react';
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
      <div className="space-y-0 mt-4 h-[400px]">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center justify-between py-3 border-b border-border animate-pulse px-1">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-muted rounded-lg" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <div className="text-right space-y-1">
              <Skeleton className="h-4 w-12 ml-auto" />
              <Skeleton className="h-3 w-10 ml-auto" />
            </div>
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
        name: capitalize((item.source || item.medium || item.campaign || item.term || item.content || 'Unknown') === 'None' ? 'Direct' : (item.source || item.medium || item.campaign || item.term || item.content || 'Unknown')),
        visitors: Number(item.unique_visitors) || 0,
        events: Number(item.visits || item.pageviews || 0),
      }))
      .sort((a, b) => b.visitors - a.visitors);
  };

  const listData = getListData(utmTab).slice(0, 30);

  const tabLabel: Record<string, string> = {
    sources: 'Source',
    mediums: 'Medium',
    campaigns: 'Campaign',
    terms: 'Term',
    content: 'Content',
  };

  if (!data || listData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/40 bg-accent/5 rounded-lg border border-dashed border-border">
        <Layers className="h-10 w-10 mb-2 opacity-20" />
        <p className="text-xs font-medium text-muted-foreground">No campaign data available</p>
      </div>
    );
  }

  return (
    <div className="h-[400px] overflow-y-auto pr-1 custom-scrollbar border-none">
      <div className="space-y-0">
        {listData.map((item, idx) => (
          <div key={idx} className="flex items-center justify-between py-3 border-b border-border last:border-0 hover:bg-accent/5 transition-colors group px-1">
            <div className="flex items-center space-x-4 flex-1 min-w-0">
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shadow-sm overflow-hidden p-1.5 group-hover:bg-primary/10 transition-colors">
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
                <div className="text-xs text-muted-foreground truncate">
                  {tabLabel[utmTab] ?? utmTab}
                </div>
              </div>
            </div>

            <div className="shrink-0 text-right">
              <div className="font-bold text-base leading-tight">
                {formatNumber(item.visitors)}
              </div>
              <div className="text-xs text-muted-foreground">
                Visitors
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const getImageForName = (name: string, _tab: string) => {
  const lower = (name || '').toLowerCase();
  if (lower.includes('google')) return '/images/sources/google.png';
  if (lower.includes('bing') || lower.includes('microsoft')) return '/images/sources/bing.png';
  if (lower.includes('facebook')) return '/images/sources/facebook.png';
  if (lower.includes('twitter') || lower.includes('x.com')) return '/images/sources/twitter.png';
  if (lower.includes('linkedin')) return '/images/sources/linkedin.png';
  if (lower.includes('instagram')) return '/images/sources/instagram.png';
  if (lower.includes('youtube')) return '/images/sources/youtube.png';
  if (lower.includes('tiktok')) return '/images/sources/tiktok.png';
  if (lower.includes('pinterest')) return '/images/sources/pinterest.png';
  if (lower.includes('reddit')) return '/images/sources/reddit.png';
  if (lower.includes('github')) return '/images/sources/github.png';
  if (lower.includes('producthunt') || lower.includes('product hunt')) return '/images/sources/producthunt.png';
  if (lower.includes('medium')) return '/images/sources/medium.png';
  if (lower.includes('stackoverflow') || lower.includes('stack overflow')) return '/images/sources/stackoverflow.png';
  if (lower.includes('telegram')) return '/images/sources/telegram.png';
  if (lower.includes('whatsapp')) return '/images/sources/whatsapp.png';
  if (lower.includes('snapchat')) return '/images/sources/snapchat.png';
  if (lower.includes('newsletter') || lower.includes('email') || lower.includes('mail')) return '/images/sources/google.png';
  return '/images/sources/google.png';
};
