'use client';

import { Globe, Layers, Search, Users, Link, Mail, MousePointerClick } from 'lucide-react';
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
  onFilter?: (filter: Record<string, string>) => void;
}

const CategoryIcons: Record<string, { icon: React.ElementType; color: string }> = {
  Direct: { icon: MousePointerClick, color: '#4285F4' },
  Search: { icon: Search, color: '#34A853' },
  Social: { icon: Users, color: '#EA4335' },
  Referral: { icon: Link, color: '#8B5CF6' },
  Email: { icon: Mail, color: '#FBBC05' },
};

const getSourceImage = (label: string) => {
  const lower = label.toLowerCase();
  if (lower.includes('google')) return '/images/browser/chrome.png';
  if (lower.includes('bing') || lower.includes('microsoft')) return '/images/browser/edge.png';
  if (lower.includes('yahoo')) return '/images/browser/safari.png';
  if (lower.includes('yandex')) return '/images/browser/yandexbrowser.png';
  if (lower.includes('duckduckgo') || lower.includes('baidu')) return '/images/browser/searchbot.png';
  if (lower.includes('facebook') || lower.includes('fb.')) return '/images/browser/facebook.png';
  if (lower.includes('instagram')) return '/images/browser/instagram.png';
  if (lower.includes('twitter') || lower.includes('x.com') || lower.includes('t.co')) return '/images/browser/unknown.png';
  if (lower.includes('reddit')) return '/images/browser/brave.png';
  if (lower.includes('youtube')) return '/images/browser/chrome.png';
  if (lower.includes('pinterest')) return '/images/browser/opera.png';
  return null;
};

export function TopSourcesChart({ data, isLoading, onViewMore, onFilter }: TopSourcesChartProps) {
  const [activeTab, setActiveTab] = useState('overview');

  // Helpers to classify categories
  const isOrganic = (r: string) => {
    const s = (r || '').toLowerCase();
    return s.includes('google') || s.includes('bing') || s.includes('yahoo') ||
           s.includes('duckduckgo') || s.includes('search') || s.includes('baidu') ||
           s.includes('yandex');
  };

  const isDirect = (r: string) => {
    const s = (r || '').toLowerCase();
    return s.includes('direct') || s.includes('none') || s.includes('null') ||
           s === '' || s.includes('(not set)');
  };

  const isSocial = (r: string) => {
    const s = (r || '').toLowerCase();
    return s.includes('facebook') || s.includes('twitter') || s.includes('linkedin') ||
           s.includes('instagram') || s.includes('reddit') || s.includes('tiktok') ||
           s.includes('pinterest') || s.includes('youtube') || s.includes('snapchat') ||
           s.includes('whatsapp') || s.includes('telegram');
  };

  const isEmail = (r: string) => {
    const s = (r || '').toLowerCase();
    return s.includes('email') || s.includes('mail') || s.includes('newsletter') ||
           s.includes('mailchimp') || s.includes('sendgrid');
  };

  if (isLoading) {
    return (
      <div className="space-y-4 h-[500px]">
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

  const getSourceData = (type: 'overview' | 'search' | 'social') => {
    if (type === 'overview') {
      const totals: Record<string, { visitors: number, color: string }> = {
        'Direct': { visitors: 0, color: '#4285F4' },
        'Search': { visitors: 0, color: '#34A853' },
        'Social': { visitors: 0, color: '#EA4335' },
        'Referral': { visitors: 0, color: '#8B5CF6' },
        'Email': { visitors: 0, color: '#FBBC05' },
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
          percentage: totalVisitors > 0 ? (v.visitors / totalVisitors) * 100 : 0
        }));
    }

    // Filter by tab type
    const filtered = referrers.filter(r =>
      type === 'search' ? isOrganic(r.referrer) : isSocial(r.referrer)
    );

    const maxVal = Math.max(...filtered.map(r => r.visitors), 1);
    return filtered
      .sort((a, b) => b.visitors - a.visitors)
      .slice(0, 30)
      .map(r => ({
        label: r.referrer || 'Direct',
        visitors: r.visitors,
        color: type === 'search' ? '#34A853' : '#EA4335',
        percentage: (r.visitors / maxVal) * 100
      }));
  };

  const PageList = ({ type }: { type: 'overview' | 'search' | 'social' }) => {
    const items = getSourceData(type);

    if (items.length === 0) {
      const emptyMessages = {
        overview: 'No traffic data available',
        search: 'No search engine traffic',
        social: 'No social media traffic'
      };

      return (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/40 bg-accent/5 rounded border border-dashed border-border/60">
          <Layers className="h-10 w-10 mb-2 opacity-20" />
          <p className="text-xs font-medium text-muted-foreground">{emptyMessages[type]}</p>
        </div>
      );
    }

    return (
      <div className="space-y-0 mt-4">
        {items.map((item, index) => {
          const categoryIcon = type === 'overview' ? CategoryIcons[item.label] : null;
          const sourceImg = type !== 'overview' ? getSourceImage(item.label) : null;

          return (
            <div key={index} className={cn("flex items-center justify-between py-3 border-b border-border/40 last:border-0 hover:bg-accent/5 transition-colors group px-1", onFilter && "cursor-pointer")} onClick={() => onFilter?.({ utm_source: item.label })}>
              <div className="flex items-center space-x-4 flex-1 min-w-0">
                <div className="flex-shrink-0 w-10 h-10 rounded bg-accent/10 flex items-center justify-center shadow-sm overflow-hidden p-1.5 group-hover:bg-primary/10 transition-colors">
                  {categoryIcon ? (
                    <categoryIcon.icon className="h-5 w-5" style={{ color: categoryIcon.color }} />
                  ) : sourceImg ? (
                    <>
                      <Image
                        src={sourceImg}
                        alt={item.label}
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
                  ) : (
                    <Globe className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-[13px] leading-tight text-foreground truncate group-hover:text-primary transition-colors" title={item.label}>{item.label}</div>
                  <div className="text-xs text-muted-foreground truncate">
                     {type === 'overview' ? 'Channel' : 'Platform'}
                  </div>
                </div>
              </div>

              <div className="shrink-0 text-right">
                <div className="text-right">
                  <div className="font-bold text-base leading-tight">
                    {formatNumber(item.visitors)}
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
    <div className="h-[500px] flex flex-col">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/60 shrink-0">
           <div>
              <h3 className="text-base font-semibold tracking-tight">Traffic Sources</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Main acquisition channels</p>
           </div>
           <TabsList className="grid grid-cols-3 h-8 w-full sm:w-[240px] bg-muted/50 p-0.5 rounded">
             <TabsTrigger value="overview" className="h-7 text-xs font-medium rounded data-[state=inactive]:text-muted-foreground data-[state=inactive]:bg-transparent data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">All</TabsTrigger>
             <TabsTrigger value="search" className="h-7 text-xs font-medium rounded data-[state=inactive]:text-muted-foreground data-[state=inactive]:bg-transparent data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">Search</TabsTrigger>
             <TabsTrigger value="social" className="h-7 text-xs font-medium rounded data-[state=inactive]:text-muted-foreground data-[state=inactive]:bg-transparent data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">Social</TabsTrigger>
           </TabsList>
        </div>

        <TabsContent value="overview" className="mt-0 focus-visible:outline-none focus:outline-none flex-1 min-h-0 overflow-hidden">
          <div className="h-full overflow-y-auto pr-1 custom-scrollbar">
            <PageList type="overview" />
          </div>
        </TabsContent>
        <TabsContent value="search" className="mt-0 focus-visible:outline-none focus:outline-none flex-1 min-h-0 overflow-hidden">
          <div className="h-full overflow-y-auto pr-1 custom-scrollbar">
            <PageList type="search" />
          </div>
        </TabsContent>
        <TabsContent value="social" className="mt-0 focus-visible:outline-none focus:outline-none flex-1 min-h-0 overflow-hidden">
          <div className="h-full overflow-y-auto pr-1 custom-scrollbar">
            <PageList type="social" />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}