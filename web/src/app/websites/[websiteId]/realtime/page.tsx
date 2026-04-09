'use client';

import { useParams } from 'next/navigation';
import { useRealtimeData, RealtimeMinute, useRecentActivity } from '@/lib/analytics-api';
import { RecentActivityFeed } from '@/components/analytics/RecentActivityFeed';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Activity, AppWindow, Globe, Monitor, ExternalLink, Eye, Users, Layers, History, type LucideIcon } from 'lucide-react';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { useMemo, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { StatCards } from '@/components/seentics-ui/StatCards';
import { websiteWorkspaceShellClass } from '@/lib/website-shell';
import { pathFromRaw, shortenSessionSlugInPath, stripWebsiteDashboardPrefix } from '@/lib/realtime-path';

// ─── Country name → flag emoji ──────────────────────────────────────────────
const COUNTRY_FLAGS: Record<string, string> = {
  'Afghanistan': 'AF', 'Albania': 'AL', 'Algeria': 'DZ', 'Argentina': 'AR', 'Australia': 'AU',
  'Austria': 'AT', 'Bangladesh': 'BD', 'Belgium': 'BE', 'Brazil': 'BR', 'Canada': 'CA',
  'Chile': 'CL', 'China': 'CN', 'Colombia': 'CO', 'Croatia': 'HR', 'Czech Republic': 'CZ',
  'Czechia': 'CZ', 'Denmark': 'DK', 'Egypt': 'EG', 'Estonia': 'EE', 'Finland': 'FI',
  'France': 'FR', 'Germany': 'DE', 'Ghana': 'GH', 'Greece': 'GR', 'Hong Kong': 'HK',
  'Hungary': 'HU', 'India': 'IN', 'Indonesia': 'ID', 'Iran': 'IR', 'Iraq': 'IQ',
  'Ireland': 'IE', 'Israel': 'IL', 'Italy': 'IT', 'Japan': 'JP', 'Jordan': 'JO',
  'Kazakhstan': 'KZ', 'Kenya': 'KE', 'Kuwait': 'KW', 'Latvia': 'LV', 'Lebanon': 'LB',
  'Lithuania': 'LT', 'Luxembourg': 'LU', 'Malaysia': 'MY', 'Mexico': 'MX', 'Morocco': 'MA',
  'Myanmar': 'MM', 'Nepal': 'NP', 'Netherlands': 'NL', 'New Zealand': 'NZ', 'Nigeria': 'NG',
  'Norway': 'NO', 'Pakistan': 'PK', 'Peru': 'PE', 'Philippines': 'PH', 'Poland': 'PL',
  'Portugal': 'PT', 'Qatar': 'QA', 'Romania': 'RO', 'Russia': 'RU', 'Saudi Arabia': 'SA',
  'Serbia': 'RS', 'Singapore': 'SG', 'Slovakia': 'SK', 'Slovenia': 'SI', 'South Africa': 'ZA',
  'South Korea': 'KR', 'Spain': 'ES', 'Sri Lanka': 'LK', 'Sweden': 'SE', 'Switzerland': 'CH',
  'Taiwan': 'TW', 'Thailand': 'TH', 'Turkey': 'TR', 'Ukraine': 'UA',
  'United Arab Emirates': 'AE', 'United Kingdom': 'GB', 'United States': 'US',
  'Uruguay': 'UY', 'Uzbekistan': 'UZ', 'Venezuela': 'VE', 'Vietnam': 'VN',
};

function countryToFlag(country: string): string {
  const code = COUNTRY_FLAGS[country];
  if (!code) return '';
  return code
    .toUpperCase()
    .split('')
    .map((c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
    .join('');
}

// ─── Browser icon ───────────────────────────────────────────────────────────
function BrowserIcon({ name }: { name: string }) {
  const n = name.toLowerCase().replace(/\s+/g, '-');
  const knownBrowsers = [
    'chrome', 'firefox', 'safari', 'edge', 'opera', 'brave', 'samsung',
    'ie', 'vivaldi', 'yandexbrowser', 'silk', 'miui', 'kakaotalk',
    'opera-mini', 'edge-chromium', 'edge-ios', 'chromium-webview',
    'android-webview', 'ios-webview', 'crios', 'fxios',
  ];
  const match = knownBrowsers.find(b => n.includes(b)) ?? 'unknown';
  return (
    <img
      src={`/images/browser/${match}.png`}
      alt={name}
      className="w-4 h-4 rounded-sm shrink-0 object-contain"
    />
  );
}

// ─── Device icon ────────────────────────────────────────────────────────────
function DeviceIcon({ name }: { name: string }) {
  const n = name.toLowerCase();
  let type = 'unknown';
  if (n.includes('mobile') || n.includes('phone')) type = 'mobile';
  else if (n.includes('tablet')) type = 'tablet';
  else if (n.includes('desktop') || n.includes('laptop')) type = 'desktop';
  return (
    <img
      src={`/images/device/${type}.png`}
      alt={name}
      className="w-4 h-4 rounded-sm shrink-0 object-contain"
    />
  );
}

// ─── Referrer favicon ───────────────────────────────────────────────────────
// ─── Parse referrer URL into a readable source name ─────────────────────────
const KNOWN_SOURCES: Record<string, string> = {
  'google': 'Google', 'facebook': 'Facebook', 'twitter': 'Twitter', 'x.com': 'Twitter',
  'linkedin': 'LinkedIn', 'reddit': 'Reddit', 'youtube': 'YouTube', 'instagram': 'Instagram',
  'pinterest': 'Pinterest', 'tiktok': 'TikTok', 'duckduckgo': 'DuckDuckGo', 'bing': 'Bing',
  'yahoo': 'Yahoo', 'github': 'GitHub', 'stackoverflow': 'Stack Overflow',
  'medium': 'Medium', 'producthunt': 'Product Hunt', 'hackernews': 'Hacker News',
  'news.ycombinator': 'Hacker News', 'telegram': 'Telegram', 't.me': 'Telegram',
  'whatsapp': 'WhatsApp', 'snapchat': 'Snapchat', 'baidu': 'Baidu', 'yandex': 'Yandex',
  'devto': 'DEV.to', 'dev.to': 'DEV.to',
};

const SOURCE_IMAGES: Record<string, string> = {
  'Google': 'google', 'Facebook': 'facebook', 'Twitter': 'twitter', 'LinkedIn': 'linkedin',
  'Reddit': 'reddit', 'YouTube': 'youtube', 'Instagram': 'instagram', 'Pinterest': 'pinterest',
  'TikTok': 'tiktok', 'DuckDuckGo': 'duckduckgo', 'Bing': 'bing', 'Yahoo': 'yahoo',
  'GitHub': 'github', 'Stack Overflow': 'stackoverflow', 'Medium': 'medium',
  'Product Hunt': 'producthunt', 'Hacker News': 'hackernews', 'Telegram': 'telegram',
  'WhatsApp': 'whatsapp', 'Snapchat': 'snapchat', 'DEV.to': 'devto',
};

function parseReferrer(raw: string): { label: string; domain: string } {
  if (!raw || raw === '(direct)' || raw === 'direct' || raw === 'Direct') {
    return { label: 'Direct', domain: '' };
  }
  const domain = raw.replace(/^https?:\/\//, '').replace(/\/.*$/, '').replace(/^www\./, '');
  for (const [key, label] of Object.entries(KNOWN_SOURCES)) {
    if (domain.includes(key)) return { label, domain };
  }
  return { label: domain, domain };
}

function ReferrerIcon({ name, domain }: { name: string; domain: string }) {
  if (name === 'Direct') {
    return (
      <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-muted text-[9px] font-bold text-muted-foreground shrink-0">
        D
      </span>
    );
  }
  const sourceImg = SOURCE_IMAGES[name];
  if (sourceImg) {
    return <img src={`/images/sources/${sourceImg}.png`} alt={name} className="w-4 h-4 rounded-sm shrink-0 object-contain" />;
  }
  return (
    <Image
      src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
      alt=""
      width={16}
      height={16}
      className="w-4 h-4 rounded shrink-0"
      unoptimized
    />
  );
}

// ─── Fill timeline gaps ─────────────────────────────────────────────────────
function fillTimeline(raw: RealtimeMinute[]): RealtimeMinute[] {
  if (raw.length === 0) return [];

  const byMinute: Record<string, RealtimeMinute> = {};
  raw.forEach((m) => {
    byMinute[m.minute] = m;
  });

  const filled: RealtimeMinute[] = [];
  const now = new Date();

  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 60000);
    const key = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    filled.push(byMinute[key] ?? { minute: key, visitors: 0, views: 0 });
  }

  return filled;
}

type RealtimeTimelineMetric = 'views' | 'visitors';

interface NameVisitorsRow {
  name: string;
  visitors: number;
}
interface ActivePageRow {
  page: string;
  visitors: number;
}

interface MergedReferrerEntry {
  label: string;
  domain: string;
  visitors: number;
}

function countPhrase(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

// ─── 30-Minute Activity Timeline ────────────────────────────────────────────
function RealtimeTimeline({
  timeline,
  metric,
}: {
  timeline: RealtimeMinute[];
  metric: RealtimeTimelineMetric;
}) {
  const filled = useMemo(() => fillTimeline(timeline), [timeline]);
  const max = useMemo(() => {
    const key = metric === 'views' ? 'views' : 'visitors';
    return Math.max(...filled.map((t) => t[key]), 1);
  }, [filled, metric]);
  const hasAnyData = useMemo(() => filled.some((t) => t.views > 0 || t.visitors > 0), [filled]);
  const idxMid = Math.floor((filled.length - 1) / 2);
  const labelMid = filled[idxMid]?.minute ?? '—';

  return (
    <div className="space-y-3">
      <div className="relative rounded-lg bg-muted/35 px-1.5 sm:px-2 pt-3 pb-2">
        <div
          className="pointer-events-none absolute inset-x-2 top-3 bottom-7 flex flex-col justify-between opacity-[0.35]"
          aria-hidden
        >
          {[0, 1, 2].map((k) => (
            <div key={k} className="h-px w-full bg-border" />
          ))}
        </div>
        <div className="relative flex gap-px sm:gap-0.5 h-[7.5rem] sm:h-[8.25rem]" role="presentation">
          {!hasAnyData && (
            <div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-muted/25">
              <p className="text-[13px] text-muted-foreground">No traffic in the last 30 minutes</p>
            </div>
          )}
          {filled.map((t, i) => {
            const v = metric === 'views' ? t.views : t.visitors;
            const height = v > 0 ? Math.max((v / max) * 100, 6) : 3;
            const isRecent = i >= filled.length - 5;
            const hasData = v > 0;
            const tip = `${t.minute} · ${countPhrase(t.views, 'view', 'views')}, ${countPhrase(t.visitors, 'visitor', 'visitors')}`;
            return (
              <div
                key={t.minute}
                className="flex min-w-0 flex-1 flex-col items-center justify-end group relative"
              >
                <div className="pointer-events-none absolute bottom-full z-20 mb-1.5 left-1/2 w-max max-w-56 -translate-x-1/2 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                  <div className="rounded-md border border-border/80 bg-popover px-2 py-1 text-center text-[10px] font-medium text-popover-foreground shadow-sm">
                    {tip}
                  </div>
                </div>
                <div
                  className={cn(
                    'w-full max-w-[7px] rounded-t-[3px] transition-all duration-300 ease-out',
                    !hasData && 'min-h-[3px] bg-muted-foreground/12',
                    hasData &&
                      isRecent &&
                      'bg-emerald-600 dark:bg-emerald-500',
                    hasData && !isRecent && 'bg-emerald-600/50 dark:bg-emerald-500/45',
                  )}
                  style={{ height: `${height}%` }}
                />
              </div>
            );
          })}
        </div>
      </div>
      <div className="flex items-center justify-between px-0.5 text-[11px] tabular-nums text-muted-foreground">
        <span>{filled[0]?.minute ?? '—'}</span>
        <span className="opacity-80">{labelMid}</span>
        <span className="font-medium text-foreground">Now</span>
      </div>
    </div>
  );
}

/** Flat panels — similar to Plausible / Fathom realtime (no heavy shadow, thin border). */
const sectionCardClass = 'rounded-lg border border-border bg-card overflow-hidden';

const scrollSectionClass = 'scroll-mt-24 md:scroll-mt-28';

function RealtimeSectionHeader({
  title,
  icon: Icon,
  right,
  className,
}: {
  title: string;
  icon?: LucideIcon;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-4 px-5 sm:px-6 py-4 border-b border-border bg-muted/30',
        className,
      )}
    >
      <div className="flex items-center gap-3 min-w-0">
        {Icon ? <Icon className="h-4 w-4 text-muted-foreground opacity-70 shrink-0" aria-hidden /> : null}
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
          {title}
        </h2>
      </div>
      {right ? <div className="shrink-0">{right}</div> : null}
    </div>
  );
}

const ACTIVE_PAGE_PATH_MAX = 52;

function activePageDisplay(
  raw: string,
  websiteId: string,
): { display: string; title: string } {
  const t = raw.trim();
  if (!t) return { display: raw, title: raw };
  let path = pathFromRaw(t);
  if (!path.startsWith('/')) path = `/${path}`;

  const canonical = stripWebsiteDashboardPrefix(path, websiteId);
  const shortenedIds = shortenSessionSlugInPath(canonical);
  const display =
    shortenedIds.length > ACTIVE_PAGE_PATH_MAX
      ? `${shortenedIds.slice(0, ACTIVE_PAGE_PATH_MAX - 1)}…`
      : shortenedIds;

  return { display, title: canonical };
}

// ─── Breakdown Row ──────────────────────────────────────────────────────────
function BreakdownRow({
  icon,
  label,
  count,
  pct,
}: {
  icon: ReactNode;
  label: string;
  count: number;
  pct: number;
}) {
  return (
    <div className="flex items-center gap-4 px-5 sm:px-6 py-3.5 sm:py-4 hover:bg-muted/20 transition-colors">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="shrink-0 opacity-90">{icon}</div>
        <span className="text-sm text-foreground truncate leading-snug">{label || '(unknown)'}</span>
      </div>
      <span className="text-xs text-muted-foreground tabular-nums shrink-0 w-10 text-right">{pct.toFixed(0)}%</span>
      <span className="text-sm font-medium text-foreground tabular-nums w-9 text-right shrink-0">{count}</span>
    </div>
  );
}

// ─── Referrer Breakdown (with URL parsing + merging) ────────────────────────
function ReferrerBreakdown({ referrers, isLoading }: { referrers: NameVisitorsRow[]; isLoading: boolean }) {
  const parsed = useMemo(() => {
    const merged: Record<string, MergedReferrerEntry> = {};
    for (const r of referrers) {
      const { label, domain } = parseReferrer(r.name);
      const existing = merged[label];
      if (existing) {
        existing.visitors += r.visitors;
      } else {
        merged[label] = { label, domain, visitors: r.visitors };
      }
    }
    return Object.values(merged).sort((a, b) => b.visitors - a.visitors);
  }, [referrers]);

  const total = useMemo(() => parsed.reduce((sum, i) => sum + i.visitors, 0), [parsed]);

  return (
    <Card id="realtime-sources" className={cn(sectionCardClass, scrollSectionClass)}>
      <RealtimeSectionHeader title="Traffic sources" icon={ExternalLink} />
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-6 space-y-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-9 bg-muted/25 rounded-lg animate-pulse" />)}</div>
        ) : parsed.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12 px-6">No referrer data</p>
        ) : (
          <div className="divide-y divide-border/50">{parsed.map((item) => {
              const pct = total > 0 ? (item.visitors / total) * 100 : 0;
              return (
                <BreakdownRow
                  key={item.label}
                  icon={<ReferrerIcon name={item.label} domain={item.domain} />}
                  label={item.label}
                  count={item.visitors}
                  pct={pct}
                />
              );
            })}</div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Breakdown Card ─────────────────────────────────────────────────────────
function BreakdownCard({
  title,
  sectionId,
  icon: Icon,
  items,
  emptyText,
  isLoading,
  renderRow,
}: {
  title: string;
  sectionId?: string;
  icon: LucideIcon;
  items: NameVisitorsRow[];
  emptyText: string;
  isLoading: boolean;
  renderRow: (item: NameVisitorsRow, pct: number) => ReactNode;
}) {
  const total = useMemo(() => items.reduce((sum, i) => sum + i.visitors, 0), [items]);

  return (
    <Card id={sectionId} className={cn(sectionCardClass, sectionId && scrollSectionClass)}>
      <RealtimeSectionHeader title={title} icon={Icon} />
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-11 bg-muted/25 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-12 text-center px-6">{emptyText}</p>
        ) : (
          <div className="divide-y divide-border/50">
            {items.map((item) => {
              const pct = total > 0 ? (item.visitors / total) * 100 : 0;
              return <div key={item.name}>{renderRow(item, pct)}</div>;
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Active Pages Table ─────────────────────────────────────────────────────
function ActivePagesTable({
  pages,
  websiteId,
  isLoading,
}: {
  pages: ActivePageRow[];
  websiteId: string;
  isLoading: boolean;
}) {
  const maxVisitors = useMemo(() => Math.max(1, ...pages.map((p) => p.visitors)), [pages]);

  const headerRight =
    !isLoading && pages.length > 0 ? (
      <span className="text-xs normal-case font-normal tracking-normal text-muted-foreground tabular-nums">
        {pages.length} {pages.length === 1 ? 'path' : 'paths'}
      </span>
    ) : null;

  let listBody: ReactNode;
  if (isLoading) {
    listBody = (
      <div className="space-y-0 divide-y divide-border/50 px-5 py-2 sm:px-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 py-3.5">
            <div className="h-4 max-w-xs flex-1 rounded bg-muted/30 animate-pulse" />
            <div className="h-1.5 flex-1 rounded-full bg-muted/25 animate-pulse" />
            <div className="h-4 w-8 rounded bg-muted/30 animate-pulse" />
          </div>
        ))}
      </div>
    );
  } else if (pages.length === 0) {
    listBody = (
      <div className="px-6 py-12 text-center">
        <p className="text-sm font-medium text-foreground">No pages in this window</p>
        <p className="mt-1 text-xs text-muted-foreground">Paths appear here as visitors load them.</p>
      </div>
    );
  } else {
    listBody = (
      <ul className="divide-y divide-border/50">
        {pages.map((p) => {
          const pageLabels = activePageDisplay(p.page, websiteId);
          const share = (p.visitors / maxVisitors) * 100;
          return (
            <li key={p.page}>
              <div
                className={cn(
                  'flex items-center gap-3 px-5 py-3 sm:gap-4 sm:px-6',
                  'transition-colors hover:bg-muted/35',
                )}
              >
                <span
                  className="min-w-0 flex-1 truncate font-mono text-sm leading-snug text-foreground"
                  title={pageLabels.title}
                >
                  {pageLabels.display}
                </span>
                <div
                  className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-muted/60 sm:w-28"
                  aria-hidden={true}
                >
                  <div
                    className="h-full rounded-full bg-emerald-600/55 transition-all duration-500 ease-out dark:bg-emerald-500/50"
                    style={{ width: `${share}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-sm font-medium tabular-nums tracking-tight text-foreground sm:w-9">
                  {p.visitors}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <Card id="realtime-active-pages" className={cn(sectionCardClass, scrollSectionClass)}>
      <RealtimeSectionHeader title="Active pages" icon={Layers} right={headerRight} />
      <CardContent className="p-0">{listBody}</CardContent>
    </Card>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function RealtimePage() {
  const params = useParams();
  const websiteId = params.websiteId as string;
  const { data, isLoading } = useRealtimeData(websiteId);
  const { data: recentActivityData, isLoading: recentActivityLoading } = useRecentActivity(websiteId ?? '', {
    limit: 50,
    refetchIntervalMs: 12_000,
    staleTimeMs: 8000,
  });
  const [activityMetric, setActivityMetric] = useState('views' as RealtimeTimelineMetric);

  return (
    <div className={cn(websiteWorkspaceShellClass, 'space-y-10')}>
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">

          <DashboardPageHeader
            title="Realtime"
            description="Live visitors, pageviews, and where traffic comes from."
            className="mb-2 gap-4 xl:gap-6"
          >
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-40 animate-ping" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
              </span>
              Updating
            </div>
          </DashboardPageHeader>

          <section id="realtime-summary" aria-label="Summary metrics" className={scrollSectionClass}>
            <StatCards
              className="mb-0 gap-4 sm:gap-5 md:gap-6"
              cardClassName="shadow-none rounded-lg border-border/80 p-5 sm:p-6 min-h-[5.5rem]"
              isLoading={isLoading}
              cards={[
                {
                  label: 'Active Visitors',
                  value: data?.active_visitors ?? 0,
                  icon: Users,
                },
                {
                  label: 'Pageviews',
                  value: data?.pageviews ?? 0,
                  icon: Eye,
                },
                {
                  label: 'Sessions',
                  value: data?.sessions ?? 0,
                  icon: Activity,
                },
                {
                  label: 'Pages / Visitor',
                  value: data?.active_visitors ? (data.pageviews / data.active_visitors).toFixed(1) : '0.0',
                  icon: Layers,
                },
              ]}
            />
          </section>

          <Card id="realtime-activity-log" className={cn(sectionCardClass, scrollSectionClass)}>
            <RealtimeSectionHeader
              title="Pageviews"
              icon={History}
              right={
                <span className="hidden sm:inline text-[11px] normal-case font-normal tracking-normal text-muted-foreground">
                  Last 24 hours
                </span>
              }
            />
            <CardContent className="px-4 pb-3 pt-2 sm:px-4 sm:pb-3 sm:pt-2.5">
              <RecentActivityFeed
                embed
                websiteId={websiteId}
                data={recentActivityData}
                isLoading={recentActivityLoading}
              />
            </CardContent>
          </Card>

          <div className="flex flex-col gap-8 xl:grid xl:grid-cols-12 xl:items-start xl:gap-x-10 xl:gap-y-8">
            <div className="xl:col-span-7 flex flex-col gap-8">
              <ActivePagesTable
                pages={data?.top_pages ?? []}
                websiteId={websiteId ?? ''}
                isLoading={isLoading}
              />

              <Card id="realtime-activity" className={cn(sectionCardClass, scrollSectionClass)}>
                <RealtimeSectionHeader
                  title="Traffic by minute"
                  icon={Activity}
                  right={
                    <div
                      className="inline-flex shrink-0 rounded-lg border border-border/80 bg-muted/20 p-0.5"
                      role="group"
                      aria-label="Chart metric"
                    >
                      <button
                        type="button"
                        onClick={() => setActivityMetric('views')}
                        className={cn(
                          'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                          activityMetric === 'views'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        Views
                      </button>
                      <button
                        type="button"
                        onClick={() => setActivityMetric('visitors')}
                        className={cn(
                          'rounded-md px-2.5 py-1 text-xs font-medium transition-colors',
                          activityMetric === 'visitors'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        Visitors
                      </button>
                    </div>
                  }
                />
                <CardContent className="px-5 pb-5 pt-4 sm:px-6 sm:pb-6 sm:pt-5">
                  {isLoading ? (
                    <div className="space-y-3">
                      <div className="h-[7.5rem] sm:h-[8.25rem] rounded-lg bg-muted/25 animate-pulse" />
                      <div className="flex justify-between">
                        <div className="h-3 w-10 rounded bg-muted/20 animate-pulse" />
                        <div className="h-3 w-10 rounded bg-muted/20 animate-pulse" />
                        <div className="h-3 w-10 rounded bg-muted/20 animate-pulse" />
                      </div>
                    </div>
                  ) : (
                    <RealtimeTimeline timeline={data?.timeline ?? []} metric={activityMetric} />
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="xl:col-span-5 flex flex-col gap-7">
              <ReferrerBreakdown referrers={data?.top_referrers ?? []} isLoading={isLoading} />
              <BreakdownCard
                title="Countries"
                sectionId="realtime-countries"
                icon={Globe}
                items={data?.top_countries ?? []}
                emptyText="No country data"
                isLoading={isLoading}
                renderRow={(item, pct) => (
                  <BreakdownRow
                    icon={<span className="text-base leading-none shrink-0">{countryToFlag(item.name) || '🌍'}</span>}
                    label={item.name}
                    count={item.visitors}
                    pct={pct}
                  />
                )}
              />
              <BreakdownCard
                title="Devices"
                sectionId="realtime-devices"
                icon={Monitor}
                items={data?.top_devices ?? []}
                emptyText="No device data"
                isLoading={isLoading}
                renderRow={(item, pct) => (
                  <BreakdownRow
                    icon={<DeviceIcon name={item.name} />}
                    label={item.name.charAt(0).toUpperCase() + item.name.slice(1)}
                    count={item.visitors}
                    pct={pct}
                  />
                )}
              />
              <BreakdownCard
                title="Browsers"
                sectionId="realtime-browsers"
                icon={AppWindow}
                items={data?.top_browsers ?? []}
                emptyText="No browser data"
                isLoading={isLoading}
                renderRow={(item, pct) => (
                  <BreakdownRow
                    icon={<BrowserIcon name={item.name} />}
                    label={item.name}
                    count={item.visitors}
                    pct={pct}
                  />
                )}
              />
            </div>
          </div>

        </div>
    </div>
  );
}
