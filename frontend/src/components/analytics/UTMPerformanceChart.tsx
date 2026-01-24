'use client';

import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Target, TrendingUp, Info, Layers, Globe } from 'lucide-react';
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
  const setUtmTab = (tab: 'sources' | 'mediums' | 'campaigns' | 'terms' | 'content') => {
    if (onTabChange) onTabChange(tab);
    else setInternalTab(tab);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center justify-between p-3 border-b animate-pulse">
            <div className="flex items-center space-x-4">
              <div className="w-8 h-8 bg-muted rounded-md" />
              <div className="h-4 w-32 bg-muted rounded" />
            </div>
            <div className="h-4 w-12 bg-muted rounded" />
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
  const maxVal = Math.max(...listData.map(d => d.visitors), 1);

  if (!data || listData.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-center space-y-2 opacity-50">
        <Layers className="h-10 w-10 text-muted-foreground mb-2" />
        <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">No Campaign Data</p>
      </div>
    );
  }

  return (
    <div className="space-y-0 animate-in fade-in duration-500">
      {listData.map((item, idx) => {
        const percentage = (item.visitors / maxVal) * 100;
        return (
          <div key={idx} className="flex items-center justify-between p-2 py-3 border-b transition-all hover:bg-gray-50/50 dark:hover:bg-gray-800/20">
            <div className="flex items-center space-x-4 flex-1 min-w-0">
              <div className="w-8 h-8 rounded-md flex items-center justify-center  shadow-sm shrink-0 overflow-hidden p-1.5 group-hover:scale-110 transition-transform">
                <Image 
                  src={getImageForName(item.name, utmTab)} 
                  alt={item.name} 
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
                <div className="font-medium text-sm text-foreground truncate" title={item.name}>
                  {item.name}
                </div>
                <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest truncate">
                  {utmTab.slice(0, -1)} Insight
                </div>
              </div>
            </div>

            <div className="shrink-0 text-right">
              <div className="text-right">
                <div className="font-bold text-base leading-tight">
                  {formatNumber(item.visitors)}
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
