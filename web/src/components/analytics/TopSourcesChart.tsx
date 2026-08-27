'use client';

import { Globe, Layers, MousePointerClick } from 'lucide-react';
import Image from 'next/image';
import React, { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
};

// Map raw referrer strings to a canonical platform name
const getCanonicalName = (referrer: string): string => {
  const s = (referrer || '').toLowerCase();
  if (s.includes('accounts.google.com')) return 'Google OAuth';
  if (s.includes('google')) return 'Google';
  if (s.includes('bing') || s.includes('microsoft')) return 'Bing';
  if (s.includes('yahoo')) return 'Yahoo';
  if (s.includes('duckduckgo')) return 'DuckDuckGo';
  if (s.includes('baidu')) return 'Baidu';
  if (s.includes('yandex')) return 'Yandex';
  if (s.includes('facebook') || s.includes('fb.')) return 'Facebook';
  if (s.includes('instagram')) return 'Instagram';
  if (s.includes('twitter') || s.includes('x.com') || s.includes('t.co')) return 'X (Twitter)';
  if (s.includes('reddit')) return 'Reddit';
  if (s.includes('youtube')) return 'YouTube';
  if (s.includes('pinterest')) return 'Pinterest';
  if (s.includes('linkedin')) return 'LinkedIn';
  if (s.includes('tiktok')) return 'TikTok';
  if (s.includes('snapchat')) return 'Snapchat';
  if (s.includes('whatsapp')) return 'WhatsApp';
  if (s.includes('telegram')) return 'Telegram';
  if (s.includes('mailchimp') || s.includes('sendgrid') || s.includes('newsletter')) return referrer;
  // Extract domain for unknown referrers instead of showing full URL
  const domain = s.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
  return domain || referrer;
};

const getSourceImage = (label: string) => {
  const lower = label.toLowerCase();
  if (lower.includes('google')) return '/images/sources/google.png';
  if (lower.includes('bing') || lower.includes('microsoft')) return '/images/sources/bing.png';
  if (lower.includes('yahoo')) return '/images/sources/yahoo.png';
  if (lower.includes('yandex')) return '/images/browser/yandexbrowser.png';
  if (lower.includes('duckduckgo')) return '/images/sources/duckduckgo.png';
  if (lower.includes('facebook') || lower.includes('fb.')) return '/images/sources/facebook.png';
  if (lower.includes('instagram')) return '/images/sources/instagram.png';
  if (lower.includes('twitter') || lower.includes('x.com') || lower.includes('t.co')) return '/images/sources/twitter.png';
  if (lower.includes('reddit')) return '/images/sources/reddit.png';
  if (lower.includes('youtube')) return '/images/sources/youtube.png';
  if (lower.includes('pinterest')) return '/images/sources/pinterest.png';
  if (lower.includes('linkedin')) return '/images/sources/linkedin.png';
  if (lower.includes('github')) return '/images/sources/github.png';
  if (lower.includes('producthunt') || lower.includes('product hunt')) return '/images/sources/producthunt.png';
  if (lower.includes('tiktok')) return '/images/sources/tiktok.png';
  if (lower.includes('medium')) return '/images/sources/medium.png';
  if (lower.includes('stackoverflow') || lower.includes('stack overflow')) return '/images/sources/stackoverflow.png';
  if (lower.includes('telegram')) return '/images/sources/telegram.png';
  if (lower.includes('whatsapp')) return '/images/sources/whatsapp.png';
  if (lower.includes('snapchat')) return '/images/sources/snapchat.png';
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
              <div className="w-4 h-4 bg-muted rounded-lg" />
              <div className="h-4 w-32 bg-muted rounded-lg" />
            </div>
            <div className="h-4 w-12 bg-muted rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  const referrers = data?.top_referrers || [];

  const getSourceData = (type: 'overview' | 'search' | 'social') => {
    // For overview: show all referrers grouped by canonical name (Direct, Google, Facebook, etc.)
    // For search/social: filter to that category then group
    const filtered = type === 'overview'
      ? referrers
      : referrers.filter(r =>
          type === 'search' ? isOrganic(r.referrer)
          : isSocial(r.referrer)
        );

    const grouped: Record<string, number> = {};
    for (const r of filtered) {
      const ref = (r.referrer || '').trim();
      /** Parent already maps raw URLs to labels (e.g. Internal Navigation). Don’t re-parse those or we lower-case and duplicate buckets. */
      const looksLikeUrl = /:\/\//.test(ref) || (ref.includes('.') && ref.includes('/') && !ref.includes(' '));
      const name = isDirect(ref) ? 'Direct' : looksLikeUrl ? getCanonicalName(ref) || 'Direct' : ref || 'Direct';
      grouped[name] = (grouped[name] || 0) + r.visitors;
    }

    const sorted = Object.entries(grouped)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 30);

    const maxVal = Math.max(...sorted.map(([, v]) => v), 1);
    return sorted.map(([name, visitors]) => ({
      label: name,
      visitors,
      color: '#2563eb',
      percentage: (visitors / maxVal) * 100
    }));
  };

  const PageList = ({ type }: { type: 'overview' | 'search' | 'social' }) => {
    const items = getSourceData(type);

    if (items.length === 0) {
      const emptyMessages: Record<'overview' | 'search' | 'social', string> = {
        overview: 'No traffic data available',
        search: 'No search engine traffic',
        social: 'No social media traffic',
      };

      return (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground/40 bg-accent/5 rounded-lg border border-dashed border-border">
          <Layers className="h-10 w-10 mb-2 opacity-20" />
          <p className="text-xs font-medium text-muted-foreground">{emptyMessages[type]}</p>
        </div>
      );
    }

    return (
      <div className="space-y-0 mt-4">
        {items.map((item, index) => {
          const directIcon = item.label === 'Direct' ? CategoryIcons['Direct'] : null;
          const sourceImg = !directIcon ? getSourceImage(item.label) : null;

          return (
            <div key={index} className={cn("flex items-center justify-between py-3 border-b border-border last:border-0 hover:bg-accent/5 transition-colors group px-1", onFilter && "cursor-pointer")} onClick={() => onFilter?.({ utm_source: item.label })}>
              <div className="flex items-center space-x-4 flex-1 min-w-0">
                <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shadow-sm overflow-hidden p-1.5 group-hover:bg-primary/10 transition-colors">
                  {directIcon ? (
                    <directIcon.icon className="h-5 w-5" style={{ color: directIcon.color }} />
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
                    <Image
                      src={`https://www.google.com/s2/favicons?domain=${item.label}&sz=32`}
                      alt={item.label}
                      width={20}
                      height={20}
                      className="object-contain"
                      unoptimized
                      onError={(e) => {
                        const target = e.target as HTMLElement;
                        target.style.display = 'none';
                        target.nextElementSibling?.classList.remove('hidden');
                      }}
                    />
                  )}
                  {!directIcon && !sourceImg && <Globe className="h-4 w-4 text-primary hidden" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-[13px] leading-tight text-foreground truncate group-hover:text-primary transition-colors" title={item.label}>{item.label}</div>
                  <div className="text-xs text-muted-foreground truncate">Source</div>
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
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border shrink-0">
           <div>
              <h3 className="text-base font-semibold tracking-tight">Traffic Sources</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Main acquisition channels</p>
           </div>
           <TabsList className="grid grid-cols-3 h-8 w-full sm:w-[240px] bg-muted/50 p-0.5 rounded-lg">
             <TabsTrigger value="overview" className="h-7 text-xs font-medium rounded-lg data-[state=inactive]:text-muted-foreground data-[state=inactive]:bg-transparent data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">All</TabsTrigger>
             <TabsTrigger value="search" className="h-7 text-xs font-medium rounded-lg data-[state=inactive]:text-muted-foreground data-[state=inactive]:bg-transparent data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">Search</TabsTrigger>
             <TabsTrigger value="social" className="h-7 text-xs font-medium rounded-lg data-[state=inactive]:text-muted-foreground data-[state=inactive]:bg-transparent data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">Social</TabsTrigger>
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