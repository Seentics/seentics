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
  /** `table` = one row per event (Page, Country, Device, …). Default `stack`. */
  rowLayout?: 'stack' | 'table';
  /** Merged onto the table scroll container (e.g. flush inside a parent `rounded-lg` card). */
  tableScrollClassName?: string;
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
      className="h-3.5 w-3.5 shrink-0 rounded-lg-[3px] object-contain opacity-90"
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

export function RecentActivityFeed({
  data,
  isLoading,
  embed,
  websiteId,
  rowLayout = 'stack',
  tableScrollClassName,
}: RecentActivityFeedProps) {
  const activities = data?.activities || [];

  if (rowLayout === 'table') {
    if (isLoading) {
      return (
        <div className="rounded-lg border border-border/50 overflow-hidden">
          <div className="grid grid-cols-[minmax(8rem,2fr)_repeat(6,minmax(4rem,1fr))] gap-2 p-3 bg-muted/20 border-b border-border/40">
            {[...Array(7)].map((_, i) => (
              <Skeleton key={i} className="h-3 rounded-lg" />
            ))}
          </div>
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-[minmax(8rem,2fr)_repeat(6,minmax(4rem,1fr))] gap-2 p-3 border-b border-border/30 last:border-b-0"
            >
              {[...Array(7)].map((_, j) => (
                <Skeleton key={j} className="h-3.5 rounded-lg" />
              ))}
            </div>
          ))}
        </div>
      );
    }
    if (activities.length === 0) {
      return (
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
      );
    }
    return (
      <div className="relative">
        <div
          className={cn(
            'overflow-x-auto overflow-y-auto rounded-lg border border-border/50',
            embed ? 'max-h-[min(28rem,55vh)]' : 'max-h-[420px]',
            tableScrollClassName,
          )}
        >
          <table className="w-full min-w-[640px] text-left text-[11px]">
            <thead className="sticky top-0 z-10 bg-muted/40 backdrop-blur-sm border-b border-border/60">
              <tr className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2.5 font-medium">Page</th>
                <th className="px-2 py-2.5 font-medium whitespace-nowrap">Country</th>
                <th className="px-2 py-2.5 font-medium whitespace-nowrap">Device</th>
                <th className="px-2 py-2.5 font-medium whitespace-nowrap">OS</th>
                <th className="px-2 py-2.5 font-medium whitespace-nowrap">Browser</th>
                <th className="px-2 py-2.5 font-medium min-w-[5rem]">Source</th>
                <th className="px-3 py-2.5 font-medium text-right whitespace-nowrap w-[4.5rem]">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {activities.map((item, i) => {
                const flag = getCountryFlag(item.country);
                const ago = timeAgo(item.timestamp);
                const isRecent = ago === 'just now' || ago.endsWith('s ago');
                const pageShown = websiteId
                  ? displayRealtimePath(item.page, websiteId, 72)
                  : item.page.length > 56
                    ? `${item.page.slice(0, 55)}…`
                    : item.page;
                const refLabel = activityReferrerLabel(item.referrer, websiteId);
                const osLabel = (item.os || '').trim();
                const deviceLabelText = (item.device || '').trim();
                const browserLabel = (item.browser || '').trim();
                return (
                  <tr
                    key={`${item.timestamp}-${i}`}
                    className={cn('bg-card hover:bg-muted/20 transition-colors', i === 0 && 'animate-in fade-in duration-300')}
                  >
                    <td className="px-3 py-2 align-middle">
                      <span className="font-mono text-[12px] font-medium text-foreground block truncate max-w-[28rem]" title={item.page}>
                        {pageShown}
                      </span>
                    </td>
                    <td className="px-2 py-2 align-middle whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-muted-foreground" title={item.country || undefined}>
                        {flag ? <span className="text-[13px] leading-none">{flag}</span> : <Globe className="h-3 w-3 opacity-50" />}
                        <span className="truncate max-w-[6.5rem]">{item.country || '—'}</span>
                      </span>
                    </td>
                    <td className="px-2 py-2 align-middle whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        {deviceLabelText ? (
                          <>
                            <MetaIcon src={getDeviceImagePath(deviceLabelText)} label={deviceLabelText} />
                            <span className="truncate max-w-[5.5rem]">{deviceLabelText}</span>
                          </>
                        ) : (
                          '—'
                        )}
                      </span>
                    </td>
                    <td className="px-2 py-2 align-middle whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        {osLabel ? (
                          <>
                            <MetaIcon src={getOsImagePath(osLabel)} label={osLabel} />
                            <span className="truncate max-w-[6rem]">{osLabel}</span>
                          </>
                        ) : (
                          '—'
                        )}
                      </span>
                    </td>
                    <td className="px-2 py-2 align-middle whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        {browserLabel ? (
                          <>
                            <MetaIcon src={getBrowserImagePath(browserLabel)} label={browserLabel} />
                            <span className="truncate max-w-[6rem]">{browserLabel}</span>
                          </>
                        ) : (
                          '—'
                        )}
                      </span>
                    </td>
                    <td className="px-2 py-2 align-middle">
                      <span className="inline-flex items-center gap-1 text-muted-foreground truncate max-w-[8rem]" title={refLabel}>
                        <ExternalLink className="h-3 w-3 shrink-0 opacity-55" />
                        <span className="truncate">{refLabel || '—'}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2 align-middle text-right whitespace-nowrap">
                      <span
                        className={cn(
                          'inline-flex items-center justify-end gap-1 tabular-nums',
                          isRecent ? 'text-primary font-medium' : 'text-muted-foreground',
                        )}
                      >
                        {isRecent && (
                          <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden>
                            <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-50 animate-ping" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
                          </span>
                        )}
                        {ago}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {activities.length > 6 && (
          <div
            className="pointer-events-none absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-card to-transparent rounded-lg-b-md"
            aria-hidden
          />
        )}
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className={cn('space-y-3', embed && 'space-y-1')}>
        {!embed && (
          <>
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-3 w-44" />
          </>
        )}
        <div className="divide-y divide-border/40">
          {[...Array(embed ? 6 : 7)].map((_, i) => (
            <div key={i} className={cn('flex flex-col gap-1.5', embed ? 'py-2.5 px-1' : 'py-3')}>
              <div className="flex items-center gap-2">
                <Skeleton className="h-3.5 flex-1 max-w-[70%] rounded-lg" />
                <Skeleton className="h-3 w-12 rounded-lg ml-auto" />
              </div>
              <div className="flex items-center gap-1.5">
                <Skeleton className="h-3.5 w-3.5 rounded-lg-sm" />
                <Skeleton className="h-3.5 w-3.5 rounded-lg-sm" />
                <Skeleton className="h-3.5 w-3.5 rounded-lg-sm" />
                <Skeleton className="h-3 w-24 rounded-lg ml-1" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      {!embed && (
        <div className="flex items-center justify-between pb-4 mb-2 border-b border-border/60">
          <div>
            <h3 className="text-base font-semibold tracking-tight">Live Activity</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Recent page views on your site</p>
          </div>
          {activities.length > 0 && (
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-lg">
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
        <div className="relative">
          <div
            className={cn(
              'overflow-y-auto overflow-x-hidden',
              embed
                ? 'max-h-[min(20rem,42vh)]'
                : 'max-h-[420px]',
            )}
          >
            <div className="divide-y divide-border/40">
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
                      'group relative flex flex-col gap-1.5 transition-colors',
                      embed
                        ? 'px-1 py-2.5 hover:bg-muted/25'
                        : 'px-8 -mx-8 py-3 hover:bg-accent/5',
                      i === 0 && 'animate-in fade-in slide-in-from-top-1 duration-300',
                    )}
                  >
                    {/* Left accent bar */}
                    <span
                      className={cn(
                        'pointer-events-none absolute left-0 top-2 bottom-2 w-[2.5px] rounded-full transition-colors',
                        embed && (isRecent
                          ? 'bg-emerald-500'
                          : 'bg-border/60 group-hover:bg-border'),
                        !embed && 'hidden',
                      )}
                      aria-hidden
                    />

                    {/* Path row */}
                    <div className={cn('flex items-center justify-between gap-3', embed && 'pl-3')}>
                      <span
                        className="font-mono text-[13px] font-medium text-foreground min-w-0 leading-snug truncate"
                        title={pageTitle}
                      >
                        {pageShown}
                      </span>

                      {/* Timestamp */}
                      <span
                        className={cn(
                          'inline-flex shrink-0 items-center gap-1.5 text-[11px] tabular-nums',
                          isRecent ? 'text-emerald-600 dark:text-emerald-500' : 'text-muted-foreground',
                        )}
                      >
                        {isRecent && (
                          <span className="relative flex h-1.5 w-1.5 shrink-0" aria-hidden>
                            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-50 animate-ping" />
                            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          </span>
                        )}
                        {ago}
                      </span>
                    </div>

                    {/* Metadata row */}
                    <div className={cn('flex flex-wrap items-center gap-x-2 gap-y-1', embed && 'pl-3')}>
                      {/* Country */}
                      <span
                        className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"
                        title={item.country || undefined}
                      >
                        {flag ? (
                          <span className="shrink-0 text-[13px] leading-none" aria-hidden>{flag}</span>
                        ) : (
                          <Globe className="h-3 w-3 shrink-0 opacity-50" aria-hidden />
                        )}
                        <span className="truncate max-w-[9rem]">{item.country || '—'}</span>
                      </span>

                      {/* Icons group */}
                      <span className="inline-flex items-center gap-1 text-muted-foreground/60" aria-hidden>·</span>
                      <span className="inline-flex items-center gap-1">
                        {deviceLabelText
                          ? <MetaIcon src={getDeviceImagePath(deviceLabelText)} label={deviceLabelText} />
                          : <MetaIcon src={getDeviceImagePath('')} label="Device" />}
                        {osLabel ? <MetaIcon src={getOsImagePath(osLabel)} label={osLabel} /> : null}
                        {browserLabel ? <MetaIcon src={getBrowserImagePath(browserLabel)} label={browserLabel} /> : null}
                      </span>

                      {/* Referrer */}
                      {showRef && (
                        <>
                          <span className="inline-flex items-center gap-1 text-muted-foreground/60" aria-hidden>·</span>
                          <span
                            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground truncate max-w-[10rem]"
                            title={refLabel}
                          >
                            <ExternalLink className="h-3 w-3 shrink-0 opacity-55" aria-hidden />
                            {refLabel}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Scroll fade */}
          {activities.length > 5 && (
            <div
              className="pointer-events-none absolute bottom-0 inset-x-0 h-10 bg-gradient-to-t from-card to-transparent"
              aria-hidden
            />
          )}
        </div>
      )}
    </div>
  );
}
