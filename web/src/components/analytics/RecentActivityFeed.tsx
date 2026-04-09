'use client';

import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Globe, ExternalLink } from 'lucide-react';
import { activityReferrerLabel, displayRealtimePath } from '@/lib/realtime-path';
import { getBrowserImagePath, getDeviceImagePath, getOsImagePath } from '@/lib/analytics-icons';

interface RecentActivityItem {
  page: string;
  country: string;
  device: string;
  browser: string;
  os?: string;
  referrer: string;
  timestamp: string;
}

interface RecentActivityFeedProps {
  data?: { activities?: RecentActivityItem[] };
  isLoading?: boolean;
  /** Omit title row; use inside a parent card header (e.g. realtime page). */
  embed?: boolean;
  /** Strips `/websites/:id` from tracked paths when set. */
  websiteId?: string;
}

function MetaIcon({ src, label }: { src: string; label: string }) {
  if (!label) return null;
  return (
    <img
      src={src}
      alt=""
      role="img"
      aria-label={label}
      title={label}
      className="h-4 w-4 shrink-0 rounded-[3px] object-contain opacity-95"
    />
  );
}

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
  const iso = timestamp.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(timestamp) ? timestamp : `${timestamp}Z`;
  const then = new Date(iso).getTime();
  const diff = Math.max(0, Math.floor((now - then) / 1000));
  if (diff < 5) return 'just now';
  if (diff < 60) return `${diff}s ago`;
  const mins = Math.floor(diff / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};

export function RecentActivityFeed({ data, isLoading, embed, websiteId }: RecentActivityFeedProps) {
  if (isLoading) {
    return (
      <div className={cn('space-y-3', embed && 'space-y-2')}>
        {!embed && (
          <>
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-3 w-44" />
          </>
        )}
        <div className="space-y-0 divide-y divide-border/50">
          {[...Array(embed ? 6 : 7)].map((_, i) => (
            <div key={i} className="py-2.5 space-y-1.5">
              <div className="flex items-center gap-2">
                <Skeleton className="h-3.5 flex-1 rounded" />
                <Skeleton className="h-3.5 w-14 rounded" />
              </div>
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-3 w-full max-w-[12rem] rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const activities = data?.activities || [];

  return (
    <div>
      {!embed && (
        <div className="flex items-center justify-between pb-4 mb-2 border-b border-border/60">
          <div>
            <h3 className="text-base font-semibold tracking-tight">Live Activity</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Recent page views on your site</p>
          </div>
          {activities.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted/50 px-2.5 py-1 rounded">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              Live
            </div>
          )}
        </div>
      )}

      {activities.length === 0 ? (
        <div className={cn('text-center space-y-3', embed ? 'py-8' : 'py-12')}>
          <div className="w-10 h-10 mx-auto rounded-full bg-muted/50 flex items-center justify-center">
            <Globe className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">No recent activity</p>
            <p className="text-xs text-muted-foreground mt-1">
              Page views will appear here as visitors browse your site.
            </p>
          </div>
        </div>
      ) : (
        <div
          className={cn(
            'max-h-[420px] overflow-y-auto overflow-x-hidden',
            embed && 'max-h-[min(20rem,42vh)] text-[13px]',
          )}
        >
          {activities.map((item, i) => {
            const flag = getCountryFlag(item.country);
            const ago = timeAgo(item.timestamp);
            const isRecent = ago === 'just now' || ago.endsWith('s ago');
            const pageShown = websiteId
              ? displayRealtimePath(item.page, websiteId, 96)
              : item.page.length > 72
                ? `${item.page.slice(0, 71)}…`
                : item.page;
            const pageTitle = item.page;
            const refLabel = activityReferrerLabel(item.referrer, websiteId);
            const showRef = Boolean(refLabel && refLabel !== pageShown);
            const osLabel = (item.os || '').trim();
            const deviceLabelText = (item.device || '').trim();
            const browserLabel = (item.browser || '').trim();
            return (
              <div
                key={`${item.timestamp}-${i}`}
                className={cn(
                  'border-b border-border/50 last:border-0 py-2',
                  embed && 'hover:bg-muted/20',
                  !embed && 'hover:bg-accent/5 -mx-8 px-8 py-2.5',
                  i === 0 && 'animate-in fade-in slide-in-from-top-1 duration-300',
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span
                    className="font-mono text-[13px] text-foreground min-w-0 leading-snug truncate"
                    title={pageTitle}
                  >
                    {pageShown}
                  </span>
                  <span
                    className={cn(
                      'text-[11px] shrink-0 tabular-nums',
                      isRecent ? 'text-emerald-600 dark:text-emerald-500' : 'text-muted-foreground',
                    )}
                  >
                    {ago}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] text-muted-foreground">
                  <span
                    className="inline-flex min-w-0 max-w-[11rem] items-center gap-1.5"
                    title={item.country || undefined}
                  >
                    {flag ? (
                      <span className="shrink-0 text-[15px] leading-none" aria-hidden>
                        {flag}
                      </span>
                    ) : (
                      <Globe className="h-3.5 w-3.5 shrink-0 opacity-50" aria-hidden />
                    )}
                    <span className="min-w-0 truncate">{item.country || '—'}</span>
                  </span>

                  <span className="text-border/70" aria-hidden>
                    ·
                  </span>

                  {deviceLabelText ? (
                    <MetaIcon src={getDeviceImagePath(deviceLabelText)} label={deviceLabelText} />
                  ) : (
                    <MetaIcon src={getDeviceImagePath('')} label="Device" />
                  )}

                  {osLabel ? <MetaIcon src={getOsImagePath(osLabel)} label={osLabel} /> : null}

                  {browserLabel ? <MetaIcon src={getBrowserImagePath(browserLabel)} label={browserLabel} /> : null}

                  {showRef ? (
                    <span className="inline-flex h-4 shrink-0 items-center" title={refLabel}>
                      <ExternalLink className="h-3.5 w-3.5 opacity-55" aria-label={`Referrer: ${refLabel}`} />
                    </span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
