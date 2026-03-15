'use client';

import { useParams } from 'next/navigation';
import { useRealtimeData, RealtimeMinute } from '@/lib/analytics-api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Activity, Globe, Monitor, ExternalLink, Eye, Users, Layers } from 'lucide-react';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { useMemo } from 'react';
import Image from 'next/image';

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

  const map = new Map<string, RealtimeMinute>();
  raw.forEach(m => map.set(m.minute, m));

  const filled: RealtimeMinute[] = [];
  const now = new Date();

  for (let i = 29; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 60000);
    const key = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    filled.push(map.get(key) ?? { minute: key, visitors: 0, views: 0 });
  }

  return filled;
}

// ─── 30-Minute Activity Timeline ────────────────────────────────────────────
function RealtimeTimeline({ timeline }: { timeline: RealtimeMinute[] }) {
  const filled = useMemo(() => fillTimeline(timeline), [timeline]);
  const max = useMemo(() => Math.max(...filled.map(t => t.views), 1), [filled]);
  const hasAnyData = useMemo(() => filled.some(t => t.views > 0 || t.visitors > 0), [filled]);

  return (
    <div className="space-y-3">
      <div className="flex gap-[2px] h-32 relative">
        {!hasAnyData && (
          <div className="absolute inset-0 flex items-center justify-center z-10">
            <p className="text-xs text-muted-foreground/50">No activity in the last 30 minutes</p>
          </div>
        )}
        {filled.map((t, i) => {
          const height = t.views > 0 ? Math.max((t.views / max) * 100, 8) : 4;
          const isRecent = i >= filled.length - 5;
          const hasData = t.views > 0;
          return (
            <div key={t.minute} className="flex-1 h-full flex flex-col justify-end items-center group relative">
              <div className="absolute -top-9 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                <div className="bg-popover text-popover-foreground text-[10px] font-medium px-2 py-1.5 rounded-md shadow-lg border whitespace-nowrap">
                  <span className="font-bold">{t.minute}</span>
                  <span className="text-muted-foreground"> · </span>
                  {t.views} views · {t.visitors} visitors
                </div>
              </div>
              <div
                className={cn(
                  "w-full rounded-[3px] transition-all duration-300",
                  hasData
                    ? isRecent
                      ? "bg-emerald-500/80 hover:bg-emerald-500"
                      : "bg-primary/40 hover:bg-primary/60"
                    : "bg-muted/20"
                )}
                style={{ height: `${height}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground/50 px-0.5 tabular-nums">
        <span>{filled[0]?.minute}</span>
        <span>{filled[Math.floor(filled.length / 2)]?.minute}</span>
        <span>{filled[filled.length - 1]?.minute}</span>
      </div>
    </div>
  );
}

// ─── Stat Card ──────────────────────────────────────────────────────────────
function StatCard({
  label,
  value,
  icon: Icon,
  color,
  isLoading,
}: {
  label: string;
  value: number;
  icon: React.ElementType;
  color: string;
  isLoading: boolean;
}) {
  return (
    <Card className="border border-border/60 bg-card shadow-sm">
      <CardContent className="p-6">
        <div className="flex items-center gap-4">
          <div className={cn("p-2.5 rounded-xl", color)}>
            <Icon size={18} className="opacity-80" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className={cn("text-2xl font-bold tabular-nums tracking-tight", isLoading && "animate-pulse")}>
              {isLoading ? '--' : value.toLocaleString()}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Breakdown Row ──────────────────────────────────────────────────────────
function BreakdownRow({
  icon,
  label,
  count,
  pct,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  pct: number;
}) {
  return (
    <div className="relative group">
      {/* Background bar */}
      <div
        className="absolute inset-y-0 left-0 bg-primary/[0.05] rounded-md transition-all duration-500"
        style={{ width: `${Math.max(pct, 3)}%` }}
      />
      <div className="relative flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-muted/20 transition-colors">
        <div className="shrink-0">{icon}</div>
        <span className="text-sm font-medium text-foreground truncate flex-1">{label || '(unknown)'}</span>
        <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">{pct.toFixed(0)}%</span>
        <span className="text-sm font-bold text-foreground tabular-nums w-8 text-right shrink-0">{count}</span>
      </div>
    </div>
  );
}

// ─── Referrer Breakdown (with URL parsing + merging) ────────────────────────
function ReferrerBreakdown({ referrers, isLoading }: { referrers: Array<{ name: string; visitors: number }>; isLoading: boolean }) {
  const parsed = useMemo(() => {
    const merged = new Map<string, { label: string; domain: string; visitors: number }>();
    for (const r of referrers) {
      const { label, domain } = parseReferrer(r.name);
      const existing = merged.get(label);
      if (existing) { existing.visitors += r.visitors; }
      else { merged.set(label, { label, domain, visitors: r.visitors }); }
    }
    return Array.from(merged.values()).sort((a, b) => b.visitors - a.visitors);
  }, [referrers]);

  const total = useMemo(() => parsed.reduce((sum, i) => sum + i.visitors, 0), [parsed]);

  return (
    <Card className="border border-border/60 bg-card shadow-sm">
      <CardHeader className="p-6 pb-4 border-b border-border/60">
        <CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-2">
          <ExternalLink size={15} className="text-muted-foreground" />
          Traffic Sources
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {isLoading ? (
          <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-8 bg-muted/20 rounded animate-pulse" />)}</div>
        ) : parsed.length === 0 ? (
          <p className="text-xs text-muted-foreground/60 text-center py-6">No referrer data</p>
        ) : (
          <div className="space-y-1">
            {parsed.map((item) => {
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
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Breakdown Card ─────────────────────────────────────────────────────────
function BreakdownCard({
  title,
  icon: Icon,
  items,
  emptyText,
  isLoading,
  renderRow,
}: {
  title: string;
  icon: React.ElementType;
  items: Array<{ name: string; visitors: number }>;
  emptyText: string;
  isLoading: boolean;
  renderRow: (item: { name: string; visitors: number }, pct: number) => React.ReactNode;
}) {
  const total = useMemo(() => items.reduce((sum, i) => sum + i.visitors, 0), [items]);

  return (
    <Card className="border border-border/60 bg-card shadow-sm">
      <CardHeader className="p-6 pb-4 border-b border-border/60">
        <CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-2">
          <Icon size={15} className="text-muted-foreground" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 bg-muted/30 rounded-md animate-pulse" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">{emptyText}</p>
        ) : (
          <div className="space-y-1">
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
  isLoading,
}: {
  pages: Array<{ page: string; visitors: number }>;
  isLoading: boolean;
}) {
  const max = pages.length > 0 ? pages[0].visitors : 1;

  return (
    <Card className="border border-border/60 bg-card shadow-sm">
      <CardHeader className="p-6 pb-4 border-b border-border/60">
        <CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-2">
          <Layers size={15} className="text-muted-foreground" />
          Active Pages
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-9 bg-muted/30 rounded animate-pulse" />
            ))}
          </div>
        ) : pages.length === 0 ? (
          <p className="text-sm text-muted-foreground py-10 text-center">No active pages right now</p>
        ) : (
          <div>
            <div className="grid grid-cols-12 gap-2 px-6 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70 border-b border-border/40">
              <div className="col-span-9">Page</div>
              <div className="col-span-3 text-right">Visitors</div>
            </div>
            <div className="divide-y divide-border/30">
              {pages.map((p) => {
                const barWidth = Math.max((p.visitors / max) * 100, 3);
                return (
                  <div
                    key={p.page}
                    className="grid grid-cols-12 gap-2 px-6 py-3 items-center hover:bg-muted/20 transition-colors relative"
                  >
                    <div
                      className="absolute inset-y-0 left-0 bg-primary/[0.04] transition-all duration-300"
                      style={{ width: `${barWidth}%` }}
                    />
                    <div className="col-span-9 relative z-10 flex items-center gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span className="text-sm font-medium text-foreground truncate">{p.page}</span>
                    </div>
                    <div className="col-span-3 text-right relative z-10">
                      <span className="text-sm font-bold tabular-nums text-foreground">{p.visitors}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function RealtimePage() {
  const { websiteId } = useParams<{ websiteId: string }>();
  const { data, isLoading } = useRealtimeData(websiteId);

  return (
    <div className="p-6 md:p-8 lg:p-10 w-full max-w-[1400px] mx-auto">
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

          {/* Header */}
          <DashboardPageHeader
            title="Realtime"
            description="Live visitor activity on your website right now."
          >
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Live</span>
            </div>
          </DashboardPageHeader>

          {/* Stat Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Active Visitors"
              value={data?.active_visitors ?? 0}
              icon={Users}
              color="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              isLoading={isLoading}
            />
            <StatCard
              label="Pageviews"
              value={data?.pageviews ?? 0}
              icon={Eye}
              color="bg-violet-500/10 text-violet-600 dark:text-violet-400"
              isLoading={isLoading}
            />
            <StatCard
              label="Sessions"
              value={data?.sessions ?? 0}
              icon={Activity}
              color="bg-violet-500/10 text-violet-600 dark:text-violet-400"
              isLoading={isLoading}
            />
            <StatCard
              label="Pages / Visitor"
              value={data?.active_visitors ? Math.round((data.pageviews / data.active_visitors) * 10) / 10 : 0}
              icon={Layers}
              color="bg-amber-500/10 text-amber-600 dark:text-amber-400"
              isLoading={isLoading}
            />
          </div>

          {/* Activity Timeline */}
          <Card className="border border-border/60 bg-card shadow-sm">
            <CardHeader className="p-6 pb-4 border-b border-border/60">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold tracking-tight flex items-center gap-2">
                  <Activity size={15} className="text-muted-foreground" />
                  Activity (last 30 minutes)
                </CardTitle>
                <span className="text-[11px] text-muted-foreground/60">per minute</span>
              </div>
            </CardHeader>
            <CardContent className="p-6">
              {isLoading ? (
                <div className="h-32 bg-muted/20 rounded animate-pulse" />
              ) : (
                <RealtimeTimeline timeline={data?.timeline ?? []} />
              )}
            </CardContent>
          </Card>

          {/* Active Pages */}
          <ActivePagesTable pages={data?.top_pages ?? []} isLoading={isLoading} />

          {/* Breakdown Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ReferrerBreakdown referrers={data?.top_referrers ?? []} isLoading={isLoading} />
            <BreakdownCard
              title="Countries"
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
              icon={Globe}
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
  );
}
