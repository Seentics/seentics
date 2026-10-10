'use client';

import { Globe, Layers, MousePointerClick } from 'lucide-react';
import Image from 'next/image';
import React from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/features/analytics/format';
import { categorizeReferrer } from '@/features/analytics/selectors';

import { useControllableState } from '@/hooks/useControllableState';

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
  onFilter?: (filter: Record<string, string>) => void;
  /** Optional controlled tab for deterministic recorded states. */
  activeTab?: 'overview' | 'search' | 'social';
  onActiveTabChange?: (tab: 'overview' | 'search' | 'social') => void;
}

const CategoryIcons: Record<string, { icon: React.ElementType; color: string }> = {
  Direct: { icon: MousePointerClick, color: '#4285F4' },
};

// Map a raw referrer to its dashboard name — by the host, as features/analytics/selectors.ts does.
const getCanonicalName = (referrer: string): string => categorizeReferrer(referrer);

export const getSourceImage = (label: string) => {
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

/** The names the dashboard gives these sources (features/analytics/selectors.ts `REFERRER_NAMES`). */
const SEARCH_LABELS = new Set(['google', 'bing', 'yahoo', 'duckduckgo', 'baidu', 'yandex', 'ecosia', 'brave']);
const SOCIAL_LABELS = new Set([
  'facebook', 'x (twitter)', 'linkedin', 'youtube', 'instagram', 'reddit', 'pinterest', 'tiktok',
  'snapchat', 'whatsapp', 'telegram',
]);
const SEARCH_HOST = /(^|\.)(google|bing|duckduckgo|yahoo|baidu|yandex|ecosia|brave)\.[a-z.]+$/;
const SOCIAL_HOST = /(^|\.)(facebook\.com|fb\.com|twitter\.com|x\.com|t\.co|linkedin\.com|lnkd\.in|instagram\.com|reddit\.com|pinterest\.com|tiktok\.com|snapchat\.com|youtube\.com|youtu\.be|whatsapp\.com|t\.me|telegram\.org)$/;

/** The host of a label that is one, else the label (a name like "google" has no dot and is matched above). */
const hostOf = (value: string) => value.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').replace(/[/?#:].*$/, '').replace(/^www\./, '');

export function TopSourcesChart({
  data,
  isLoading,
  onFilter,
  activeTab,
  onActiveTabChange,
}: TopSourcesChartProps) {
  const [selectedTab, handleTabChange] = useControllableState({
    value: activeTab,
    defaultValue: 'overview' as const,
    onChange: onActiveTabChange,
  });

  // Which tab a source belongs under. By the whole name or the whole host, never by a piece of it:
  // `includes('direct')` made "redirect.example.com" Direct, `includes('search')` put ResearchGate
  // under Search, and "Google OAuth" (a sign-in the visitor returned from) is not a search.
  const isOrganic = (r: string) => {
    const s = (r || '').trim().toLowerCase();
    if (s === 'google oauth') return false;
    return SEARCH_LABELS.has(s) || SEARCH_HOST.test(hostOf(s));
  };

  const isDirect = (r: string) => {
    const s = (r || '').trim().toLowerCase();
    return s === '' || s === 'direct' || s === '(direct)' || s === '(none)' || s === 'none' || s === 'null' || s === '(not set)';
  };

  const isSocial = (r: string) => {
    const s = (r || '').trim().toLowerCase();
    return SOCIAL_LABELS.has(s) || SOCIAL_HOST.test(hostOf(s));
  };

  if (isLoading) {
    return (
      <div className="space-y-4 h-[420px]">
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
      <div className="mt-2">
        {items.map((item, index) => {
          const directIcon = item.label === 'Direct' ? CategoryIcons['Direct'] : null;
          const sourceImg = !directIcon ? getSourceImage(item.label) : null;

          return (
            <div key={index} className={cn("relative flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-accent/10 transition-colors group", onFilter && "cursor-pointer")} onClick={() => onFilter?.({ utm_source: item.label })}>
              <div
                className="absolute inset-y-0.5 left-0 rounded-md bg-primary/10"
                style={{ width: `${Math.max(2, item.percentage)}%` }}
              />
              <div className="relative flex items-center gap-2 flex-1 min-w-0">
                <div className="flex-shrink-0 w-4 h-4 flex items-center justify-center overflow-hidden">
                  {directIcon ? (
                    <directIcon.icon className="h-5 w-5" style={{ color: directIcon.color }} />
                  ) : sourceImg ? (
                    <>
                      <Image
                        src={sourceImg}
                        alt={item.label}
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
                  ) : (
                    <Image
                      src={`https://www.google.com/s2/favicons?domain=${item.label}&sz=32`}
                      alt={item.label}
                      width={20}
                      height={20}
                      className="h-4 w-4 object-contain"
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
                <span className="truncate text-[13px] font-medium text-foreground group-hover:text-primary transition-colors" title={item.label}>{item.label}</span>
              </div>

              <div className="relative shrink-0 text-right text-[13px] font-semibold tabular-nums">
                {formatNumber(item.visitors)}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col">
      <Tabs value={selectedTab} onValueChange={(value) => handleTabChange(value as 'overview' | 'search' | 'social')} className="flex-1 flex flex-col min-h-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border shrink-0">
           <h3 className="text-sm font-semibold tracking-tight">Traffic Sources</h3>
           <TabsList className="grid grid-cols-3 h-8 w-full sm:w-[240px] bg-muted p-0.5 rounded-lg">
             <TabsTrigger value="overview" className="h-7 text-xs font-medium rounded-lg data-[state=inactive]:text-muted-foreground data-[state=inactive]:bg-transparent data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">All</TabsTrigger>
             <TabsTrigger value="search" className="h-7 text-xs font-medium rounded-lg data-[state=inactive]:text-muted-foreground data-[state=inactive]:bg-transparent data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">Search</TabsTrigger>
             <TabsTrigger value="social" className="h-7 text-xs font-medium rounded-lg data-[state=inactive]:text-muted-foreground data-[state=inactive]:bg-transparent data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">Social</TabsTrigger>
           </TabsList>
        </div>

        <TabsContent value="overview" className="mt-0 focus-visible:outline-none focus:outline-none flex-1 min-h-0 overflow-hidden">
          <div className="max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
            <PageList type="overview" />
          </div>
        </TabsContent>
        <TabsContent value="search" className="mt-0 focus-visible:outline-none focus:outline-none flex-1 min-h-0 overflow-hidden">
          <div className="max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
            <PageList type="search" />
          </div>
        </TabsContent>
        <TabsContent value="social" className="mt-0 focus-visible:outline-none focus:outline-none flex-1 min-h-0 overflow-hidden">
          <div className="max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
            <PageList type="social" />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
