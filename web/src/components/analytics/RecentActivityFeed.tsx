'use client';

import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  Monitor,
  Smartphone,
  Tablet,
  Globe,
  ExternalLink,
} from 'lucide-react';

interface RecentActivityItem {
  page: string;
  country: string;
  device: string;
  browser: string;
  referrer: string;
  timestamp: string;
}

interface RecentActivityFeedProps {
  data?: { activities?: RecentActivityItem[] };
  isLoading?: boolean;
}

const deviceLabel = (device: string) => {
  const d = device.toLowerCase();
  if (d.includes('mobile') || d.includes('phone')) return { Icon: Smartphone, label: 'Mobile' };
  if (d.includes('tablet')) return { Icon: Tablet, label: 'Tablet' };
  return { Icon: Monitor, label: 'Desktop' };
};

const getCountryFlag = (country: string): string => {
  const map: Record<string, string> = {
    'United States': 'US', 'USA': 'US', 'US': 'US',
    'Bangladesh': 'BD', 'India': 'IN', 'China': 'CN',
    'United Kingdom': 'GB', 'UK': 'GB', 'Germany': 'DE',
    'France': 'FR', 'Canada': 'CA', 'Australia': 'AU',
    'Japan': 'JP', 'Brazil': 'BR', 'Russia': 'RU',
    'South Korea': 'KR', 'Italy': 'IT', 'Spain': 'ES',
    'Netherlands': 'NL', 'Sweden': 'SE', 'Norway': 'NO',
    'Denmark': 'DK', 'Finland': 'FI', 'Switzerland': 'CH',
    'Austria': 'AT', 'Belgium': 'BE', 'Poland': 'PL',
    'Portugal': 'PT', 'Ireland': 'IE', 'New Zealand': 'NZ',
    'Singapore': 'SG', 'Indonesia': 'ID', 'Thailand': 'TH',
    'Vietnam': 'VN', 'Philippines': 'PH', 'Malaysia': 'MY',
    'Mexico': 'MX', 'Argentina': 'AR', 'Colombia': 'CO',
    'Turkey': 'TR', 'Ukraine': 'UA', 'Romania': 'RO',
    'Czech Republic': 'CZ', 'Hungary': 'HU', 'Greece': 'GR',
    'Israel': 'IL', 'Saudi Arabia': 'SA', 'South Africa': 'ZA',
    'Nigeria': 'NG', 'Egypt': 'EG', 'Kenya': 'KE',
    'Pakistan': 'PK', 'Sri Lanka': 'LK', 'Nepal': 'NP',
  };
  const code = map[country] || country;
  if (code.length === 2) {
    return String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
  }
  return '';
};

const timeAgo = (timestamp: string): string => {
  const now = Date.now();
  const then = new Date(timestamp + 'Z').getTime();
  const diff = Math.max(0, Math.floor((now - then) / 1000));
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

const shortenUUID = (s: string): string => {
  // abc12345-1234-1234-1234-123456789abc → abc1…9abc
  return s.replace(
    /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi,
    (m) => m.slice(0, 4) + '…' + m.slice(-4)
  );
};

const shortenPage = (page: string): string => {
  if (page === '/') return '/';
  const clean = page.replace(/\/$/, '');
  // First try shortening UUIDs in the path
  const withShortIds = shortenUUID(clean);
  if (withShortIds.length <= 45) return withShortIds;
  // Still too long — show last meaningful segments
  const segments = clean.split('/').filter(Boolean);
  if (segments.length <= 1) return withShortIds.slice(0, 42) + '...';
  const last = shortenUUID(segments[segments.length - 1]);
  const secondLast = segments.length > 2 ? shortenUUID(segments[segments.length - 2]) : null;
  const tail = secondLast ? `${secondLast}/${last}` : last;
  const result = `/…/${tail}`;
  if (result.length > 45) return `/…/${last}`;
  return result;
};

const shortenReferrer = (referrer: string): string => {
  if (!referrer) return '';
  try {
    const url = new URL(referrer.startsWith('http') ? referrer : `https://${referrer}`);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return referrer.length > 20 ? referrer.slice(0, 17) + '...' : referrer;
  }
};

export function RecentActivityFeed({ data, isLoading }: RecentActivityFeedProps) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-3 w-44" />
        <div className="space-y-1">
          {[...Array(7)].map((_, i) => (
            <div key={i} className="py-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <Skeleton className="h-3.5 flex-1" />
                <Skeleton className="h-3 w-14" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-14" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const activities = data?.activities || [];

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-bold tracking-tight">Live Activity</h3>
          <p className="text-xs text-muted-foreground">Recent page views on your site</p>
        </div>
        {activities.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-accent/10 px-2 py-1 rounded">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
            </span>
            Live
          </div>
        )}
      </div>

      {activities.length === 0 ? (
        <div className="text-center py-10 space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
            <Globe className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">No recent activity</p>
            <p className="text-xs text-muted-foreground mt-1">
              Page views will appear here as visitors browse your site.
            </p>
          </div>
        </div>
      ) : (
        <div className="max-h-[420px] overflow-y-auto -mx-1 px-1">
          {activities.map((item, i) => {
            const { Icon: DeviceIcon, label: deviceName } = deviceLabel(item.device);
            const flag = getCountryFlag(item.country);
            const ago = timeAgo(item.timestamp);
            const isRecent = ago === 'just now' || ago.endsWith('s ago');
            const referrerHost = shortenReferrer(item.referrer);

            return (
              <div
                key={`${item.timestamp}-${i}`}
                className={cn(
                  "px-3 py-2.5 rounded-md transition-colors hover:bg-accent/5 border-b border-border/30 last:border-0",
                  i === 0 && "animate-in fade-in slide-in-from-top-1 duration-300"
                )}
              >
                {/* Row 1: Page path + time */}
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="text-sm font-medium text-foreground truncate flex-1 min-w-0"
                    title={item.page}
                  >
                    {shortenPage(item.page)}
                  </span>
                  <span
                    className={cn(
                      "text-[11px] font-medium shrink-0 tabular-nums",
                      isRecent ? "text-emerald-500" : "text-muted-foreground"
                    )}
                  >
                    {ago}
                  </span>
                </div>

                {/* Row 2: Country, device, browser, referrer */}
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  {/* Country */}
                  {(flag || item.country) && (
                    <span className="flex items-center gap-1 shrink-0">
                      {flag && <span className="text-xs">{flag}</span>}
                      <span>{item.country || 'Unknown'}</span>
                    </span>
                  )}

                  {(flag || item.country) && <span className="text-border">·</span>}

                  {/* Device */}
                  <span className="flex items-center gap-1 shrink-0">
                    <DeviceIcon className="h-3 w-3" />
                    <span>{deviceName}</span>
                  </span>

                  {item.browser && (
                    <>
                      <span className="text-border">·</span>
                      <span className="truncate">{item.browser}</span>
                    </>
                  )}

                  {referrerHost && (
                    <>
                      <span className="text-border">·</span>
                      <span className="flex items-center gap-0.5 truncate">
                        <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                        {referrerHost}
                      </span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
