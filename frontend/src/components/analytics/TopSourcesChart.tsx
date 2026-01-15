'use client';

import { ExternalLink, LinkIcon, Mail, Search, Share2 } from 'lucide-react';
import Image from 'next/image';

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

export function TopSourcesChart({ data, isLoading, onViewMore }: TopSourcesChartProps) {
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
  const isInternal = (r: string) => {
    const s = (r || '').toLowerCase();
    return s.includes('localhost') || s.includes('127.0.0.1') || s.includes('internal');
  };

  // Aggregate into categories
  const totals = {
    'Direct': 0,
    'Organic Search': 0,
    'Social': 0,
    'Email': 0,
    'Internal Navigation': 0,
    'Other Referral': 0,
  } as Record<string, number>;

  const items = data?.top_referrers || [];
  for (const item of items) {
    const ref = item.referrer || '';
    if (isDirect(ref)) totals['Direct'] += item.visitors || 0;
    else if (isOrganic(ref)) totals['Organic Search'] += item.visitors || 0;
    else if (isSocial(ref)) totals['Social'] += item.visitors || 0;
    else if (isEmail(ref)) totals['Email'] += item.visitors || 0;
    else if (isInternal(ref)) totals['Internal Navigation'] += item.visitors || 0;
    else totals['Other Referral'] += item.visitors || 0;
  }

  const palette = ['#4285F4', '#34A853', '#EA4335', '#FBBC05', '#8B5CF6', '#06B6D4'];
  const colorFor = (name: string) => {
    const idx = Object.keys(totals).indexOf(name);
    return palette[idx % palette.length];
  };
  const imageFor = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('organic')) return '/images/search.png';
    if (n.includes('social')) return '/images/facebook.png';
    if (n.includes('email')) return '/images/search.png';
    if (n.includes('direct')) return '/images/link.png';
    if (n.includes('internal')) return '/images/link.png';
    return '/images/planet-earth.png';
  };

  const totalVisitors = Object.values(totals).reduce((a, b) => a + b, 0);
  const sourceData = Object.entries(totals)
    .filter(([, v]) => v > 0)
    .map(([name, v]) => ({
      source: name,
      visitors: v,
      percentage: totalVisitors > 0 ? Math.round((v / totalVisitors) * 100) : 0,
      color: colorFor(name),
      image: imageFor(name),
      type: name,
    }));

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg"></div>
                <div>
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16 mb-1"></div>
                  <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-12"></div>
                </div>
                <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data?.top_referrers || data.top_referrers.length === 0 || sourceData.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <div className="text-sm">No source data available</div>
        <div className="text-xs">Source data will appear here once visitors start coming to your site</div>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      <div className="space-y-4">
        {/* Top Sources (categories) */}
        <div className="space-y-3">
          {sourceData.slice(0, 5).map((item) => {
            return (
              <div key={item.source} className="flex items-center justify-between p-3 border-b">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg overflow-hidden" style={{ backgroundColor: `${item.color}20` }}>
                      <Image
                        src={item.image}
                        alt={item.source}
                        width={16}
                        height={16}
                        className="object-contain"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          target.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                      <div className="hidden">
                        {item.source.toLowerCase().includes('organic') ? (
                          <Search className="h-4 w-4" style={{ color: item.color }} />
                        ) : item.source.toLowerCase().includes('social') ? (
                          <Share2 className="h-4 w-4" style={{ color: item.color }} />
                        ) : item.source.toLowerCase().includes('email') ? (
                          <Mail className="h-4 w-4" style={{ color: item.color }} />
                        ) : item.source.toLowerCase().includes('direct') ? (
                          <ExternalLink className="h-4 w-4" style={{ color: item.color }} />
                        ) : (
                          <LinkIcon className="h-4 w-4" style={{ color: item.color }} />
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="font-medium text-sm">{item.source}</p>
                      <p className="text-xs text-muted-foreground">{item.type}</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-sm font-semibold">{(item.visitors || 0).toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">{item.percentage}%</p>
                  </div>
                  <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{
                        width: `${item.percentage}%`,
                        backgroundColor: item.color
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}