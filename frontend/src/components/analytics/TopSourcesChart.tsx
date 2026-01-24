'use client';

import { 
  ExternalLink, 
  LinkIcon, 
  Mail, 
  Search, 
  Share2, 
  BarChart3, 
  Globe, 
  Layers 
} from 'lucide-react';
import Image from 'next/image';
import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/analytics-api';
import { Skeleton } from '@/components/ui/skeleton';

interface TopSourcesChartProps {
  data?: {
    top_referrers: Array<{
      referrer: string;
      visitors: number;
      page_views: number;
      avg_session_duration: number;
    }>;
  };
  isLoading?: boolean;
  onViewMore?: () => void;
}

const getSourceImage = (label: string) => {
  const lower = label.toLowerCase();
  if (lower.includes('google') || lower.includes('search') || lower.includes('bing') || lower.includes('yahoo')) return '/images/search.png';
  if (lower.includes('facebook') || lower.includes('fb')) return '/images/facebook.png';
  if (lower.includes('twitter') || lower.includes('x.com')) return '/images/twitter.png';
  if (lower.includes('linkedin')) return '/images/linkedin.png';
  if (lower.includes('instagram')) return '/images/instagram.png';
  if (lower.includes('tiktok')) return '/images/tiktok.png';
  if (lower.includes('pinterest')) return '/images/pinterest.png';
  if (lower.includes('email') || lower.includes('mail')) return '/images/search.png'; // Fallback for email
  if (lower.includes('direct') || lower.includes('referral') || lower.includes('link')) return '/images/link.png';
  return '/images/planet-earth.png';
};

export function TopSourcesChart({ data, isLoading, onViewMore }: TopSourcesChartProps) {
  const [activeTab, setActiveTab] = useState('overview');

  // Helpers to classify categories
  const isOrganic = (r: string) => {
    const s = (r || '').toLowerCase();
    return s.includes('google') || s.includes('bing') || s.includes('yahoo') || s.includes('duckduckgo');
  };
  const isDirect = (r: string) => (r || '').toLowerCase().includes('direct');
  const isSocial = (r: string) => {
    const s = (r || '').toLowerCase();
    return s.includes('facebook') || s.includes('twitter') || s.includes('linkedin') || s.includes('instagram') || s.includes('reddit') || s.includes('tiktok') || s.includes('pinterest') || s.includes('youtube');
  };
  const isEmail = (r: string) => {
    const s = (r || '').toLowerCase();
    return s.includes('email') || s.includes('mail');
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center justify-between p-3 border-b animate-pulse">
            <div className="flex items-center space-x-4">
              <div className="w-4 h-4 bg-muted rounded" />
              <div className="h-4 w-32 bg-muted rounded" />
            </div>
            <div className="h-4 w-12 bg-muted rounded" />
          </div>
        ))}
      </div>
    );
  }

  const referrers = data?.top_referrers || [];
  const totalVisitors = referrers.reduce((sum, item) => sum + (item.visitors || 0), 0);

  const getSourceData = (type: 'overview' | 'referrers' | 'search' | 'social') => {
    if (type === 'overview') {
      const totals: Record<string, { visitors: number, color: string }> = {
        'Direct': { visitors: 0, color: '#4285F4' },
        'Search': { visitors: 0, color: '#34A853' },
        'Social': { visitors: 0, color: '#EA4335' },
        'Email': { visitors: 0, color: '#FBBC05' },
        'Referral': { visitors: 0, color: '#8B5CF6' },
      };

      referrers.forEach(item => {
        const ref = item.referrer || '';
        if (isDirect(ref)) totals['Direct'].visitors += item.visitors;
        else if (isOrganic(ref)) totals['Search'].visitors += item.visitors;
        else if (isSocial(ref)) totals['Social'].visitors += item.visitors;
        else if (isEmail(ref)) totals['Email'].visitors += item.visitors;
        else totals['Referral'].visitors += item.visitors;
      });

      return Object.entries(totals)
        .filter(([, v]) => v.visitors > 0)
        .map(([name, v]) => ({
          label: name,
          visitors: v.visitors,
          color: v.color,
          image: getSourceImage(name),
          percentage: totalVisitors > 0 ? (v.visitors / totalVisitors) * 100 : 0
        }));
    }

    let filtered = referrers;
    if (type === 'search') filtered = referrers.filter(r => isOrganic(r.referrer));
    if (type === 'social') filtered = referrers.filter(r => isSocial(r.referrer));

    const maxVal = Math.max(...filtered.map(r => r.visitors), 1);
    return filtered
      .sort((a, b) => b.visitors - a.visitors)
      .slice(0, 8)
      .map(r => ({
        label: r.referrer || 'Direct',
        visitors: r.visitors,
        color: type === 'search' ? '#34A853' : type === 'social' ? '#EA4335' : '#4285F4',
        image: getSourceImage(r.referrer || 'Direct'),
        percentage: (r.visitors / maxVal) * 100
      }));
  };

  const PageList = ({ type }: { type: 'overview' | 'referrers' | 'search' | 'social' }) => {
    const items = getSourceData(type);

    if (items.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground opacity-50">
          <Layers className="h-10 w-10 mb-2" />
          <p className="text-sm">No traffic data available</p>
        </div>
      );
    }

    return (
      <div className="space-y-0">
        {items.map((item, index) => (
          <div key={index} className="flex items-center justify-between p-2 py-3 border-b transition-all hover:bg-gray-50/50 dark:hover:bg-gray-800/20">
            <div className="flex items-center space-x-4 flex-1 min-w-0">
              <div className="flex-shrink-0 w-8 h-8 rounded-md flex items-center justify-center  shadow-sm overflow-hidden p-1.5 transition-transform hover:scale-110">
                <Image
                  src={item.image}
                  alt={item.label}
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
                <div className="font-medium text-sm text-foreground truncate" title={item.label}>{item.label}</div>
                <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest truncate">
                   {type === 'overview' ? 'Channel' : 'Platform'} Insight
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
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-4">
           <div>
              <CardTitle className="text-base font-semibold">Traffic Sources</CardTitle>
              <p className="text-xs text-muted-foreground">Main acquisition channels</p>
           </div>
           <TabsList className="grid grid-cols-4 h-9 w-full sm:w-auto p-1 ">
             <TabsTrigger value="overview" className="text-[11px] font-semibold px-2">Total</TabsTrigger>
             <TabsTrigger value="referrers" className="text-[11px] font-semibold px-2">Refer</TabsTrigger>
             <TabsTrigger value="search" className="text-[11px] font-semibold px-2">Search</TabsTrigger>
             <TabsTrigger value="social" className="text-[11px] font-semibold px-2">Social</TabsTrigger>
           </TabsList>
        </div>
        
        <TabsContent value="overview" className="mt-0 focus-visible:outline-none">
          <PageList type="overview" />
        </TabsContent>
        <TabsContent value="referrers" className="mt-0 focus-visible:outline-none">
          <PageList type="referrers" />
        </TabsContent>
        <TabsContent value="search" className="mt-0 focus-visible:outline-none">
          <PageList type="search" />
        </TabsContent>
        <TabsContent value="social" className="mt-0 focus-visible:outline-none">
          <PageList type="social" />
        </TabsContent>
      </Tabs>
    </div>
  );
}