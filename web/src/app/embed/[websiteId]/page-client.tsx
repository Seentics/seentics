'use client';

import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Clock, Eye, Link2Off, Loader2, MousePointerClick, Users } from 'lucide-react';
import { usePathSegment } from '@/lib/path-segment';
import { cn } from '@/lib/utils';
import { StatCards } from '@/components/seentics-ui/StatCards';
import { EmbedTokenError, fetchEmbedSummary, type EmbedSummary } from '@/features/embed/api';

/**
 * An iframed dashboard: `/embed/:websiteId?token=…&theme=light|dark&days=7|30|90`.
 *
 * No sidebar, header or account menu — it lives inside a customer's own product. The
 * theme is applied to this document only and never stored, so an embed cannot change the
 * dashboard theme of someone signed in to Seentics in the same browser. Height is posted
 * to the parent (`seentics:embed:resize`) so the iframe can size itself.
 */

const RANGES = [7, 30, 90] as const;

function readParams() {
  const p = new URLSearchParams(window.location.search);
  const days = Number(p.get('days'));
  return {
    token: p.get('token') ?? '',
    theme: p.get('theme') === 'light' ? 'light' : p.get('theme') === 'dark' ? 'dark' : null,
    days: (RANGES as readonly number[]).includes(days) ? days : 30,
  };
}

const formatDuration = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}m ${Math.round(s % 60)}s` : `${Math.round(s)}s`);
const change = (n?: number) => (n === undefined || n === 0 ? undefined : `${n > 0 ? '+' : ''}${n.toFixed(1)}% vs previous`);

function TopList<K extends string>({ title, rows, label }: { title: string; rows: (Record<K, string> & { views: number })[]; label: K }) {
  const max = Math.max(1, ...rows.map(r => r.views));
  return (
    <div className="surface p-4">
      <div className="mb-3 flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <span>{title}</span>
        <span>Views</span>
      </div>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted-foreground">No data yet</p>
      ) : (
        <ul className="space-y-1.5">
          {rows.slice(0, 6).map(r => (
            <li key={r[label]} className="relative flex items-center justify-between overflow-hidden rounded-md px-2 py-1.5 text-sm">
              <span className="absolute inset-y-0 left-0 rounded-md bg-primary/10" style={{ width: `${(r.views / max) * 100}%` }} />
              <span className="relative truncate pr-3 text-foreground">{r[label]}</span>
              <span className="relative shrink-0 tabular-nums text-muted-foreground">{r.views.toLocaleString()}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Every day of the window, zero where nothing happened. The API returns only days with
 * traffic, and a chart of just those draws a straight line across the gaps.
 */
function fillDays(stats: EmbedSummary['daily']['daily_stats'], days: number) {
  const byDate = new Map(stats.map(s => [s.date.slice(0, 10), s]));
  const latest = stats.reduce((m, s) => (s.date > m ? s.date : m), new Date().toISOString().slice(0, 10));
  const end = new Date(`${latest.slice(0, 10)}T00:00:00Z`);
  return Array.from({ length: days }, (_, i) => {
    const date = new Date(end.getTime() - (days - 1 - i) * 86_400_000).toISOString().slice(0, 10);
    return byDate.get(date) ?? { date, views: 0, unique: 0 };
  });
}

function Summary({ data, days, onDays }: { data: EmbedSummary; days: number; onDays: (d: number) => void }) {
  const d = data.dashboard;
  const series = fillDays(data.daily.daily_stats, data.days);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold text-foreground">{data.website.name}</h1>
          <p className="truncate text-xs text-muted-foreground">{data.website.url}</p>
        </div>
        <div className="inline-flex rounded-lg border border-border bg-white p-0.5 shadow-sm dark:bg-muted">
          {RANGES.map(r => (
            <button
              key={r}
              onClick={() => onDays(r)}
              className={cn(
                'rounded-md px-3 py-1 text-xs font-medium transition-colors',
                days === r ? 'bg-primary/10 text-primary dark:bg-background dark:text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {r}d
            </button>
          ))}
        </div>
      </div>

      <StatCards
        className="mb-0"
        cards={[
          { label: 'Visitors', value: d.unique_visitors, icon: Users, tone: 'info', subtext: change(d.comparison?.visitor_change) },
          { label: 'Page views', value: d.page_views, icon: Eye, tone: 'accent', subtext: change(d.comparison?.pageview_change) },
          { label: 'Bounce rate', value: `${Number(d.bounce_rate).toFixed(1)}%`, icon: MousePointerClick, tone: 'warning' },
          { label: 'Avg. visit', value: formatDuration(d.session_duration), icon: Clock, tone: 'success' },
        ]}
      />

      <div className="surface p-4">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Traffic</p>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
              <defs>
                <linearGradient id="embedViews" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tickLine={false} axisLine={false} fontSize={11} tick={{ fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(v: string) => new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} minTickGap={24} />
              <YAxis tickLine={false} axisLine={false} fontSize={11} tick={{ fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip
                contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                labelFormatter={(v: string) => new Date(v).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              />
              <Area type="monotone" dataKey="views" name="Page views" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#embedViews)" />
              <Area type="monotone" dataKey="unique" name="Visitors" stroke="hsl(var(--primary))" strokeOpacity={0.45} strokeWidth={1.5} fill="none" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <TopList title="Top pages" rows={data.top_pages.top_pages} label="page" />
        <TopList title="Referrers" rows={data.top_referrers.top_referrers} label="referrer" />
        <TopList title="Countries" rows={data.top_countries.top_countries} label="country" />
        <TopList title="Devices" rows={data.top_devices.top_devices} label="device" />
      </div>

      <p className="text-center text-[11px] text-muted-foreground">
        Analytics by{' '}
        <a href="https://seentics.com" target="_blank" rel="noopener noreferrer" className="font-medium hover:text-foreground">
          Seentics
        </a>
      </p>
    </div>
  );
}

export default function EmbedPage() {
  const websiteId = usePathSegment(1) ?? '';
  const [params, setParams] = useState<ReturnType<typeof readParams> | null>(null);
  const [days, setDays] = useState(30);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const p = readParams();
    setParams(p);
    setDays(p.days);
    // This document only, never storage: see the note above.
    if (p.theme) {
      const apply = () => document.documentElement.classList.toggle('dark', p.theme === 'dark');
      apply();
      const t = setTimeout(apply, 50);
      return () => clearTimeout(t);
    }
  }, []);

  const { data, error, isLoading } = useQuery({
    queryKey: ['embed-summary', websiteId, days],
    queryFn: () => fetchEmbedSummary(websiteId, params!.token, days),
    enabled: !!websiteId && !!params,
    retry: (count, e) => !(e instanceof EmbedTokenError) && count < 2,
    placeholderData: prev => prev,
  });

  // Tell the parent how tall the content is, so the iframe can fit it without a scrollbar.
  useEffect(() => {
    const el = root.current;
    if (!el || window.parent === window) return;
    const post = () => window.parent.postMessage({ type: 'seentics:embed:resize', height: el.scrollHeight }, '*');
    const ro = new ResizeObserver(post);
    ro.observe(el);
    post();
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={root} className="min-h-[200px] bg-background p-4">
      {error ? (
        <div className="surface flex flex-col items-center gap-2 py-12 text-center">
          <Link2Off className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">
            {error instanceof EmbedTokenError ? 'This embed link has expired' : "This dashboard couldn't load"}
          </p>
          <p className="max-w-xs text-xs text-muted-foreground">
            {error instanceof EmbedTokenError
              ? 'Reload the page that shows it to get a fresh link.'
              : 'Please try again in a moment.'}
          </p>
        </div>
      ) : isLoading || !data ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Summary data={data} days={days} onDays={setDays} />
      )}
    </div>
  );
}
