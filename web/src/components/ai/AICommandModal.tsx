'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Sparkles, Send, X, Loader2, AlertCircle, TrendingUp,
  Lock, History, RotateCcw, Globe, Monitor, MousePointer,
  BarChart2, Hash, ArrowUpRight, Zap, ArrowLeft,
  DollarSign, Video, Flame, Filter, Bot,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import api from '@/lib/api';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

type AIDomain = 'analytics' | 'revenue' | 'replays' | 'heatmaps' | 'funnels' | 'automations';

interface Column { key: string; label: string; }

interface AIQueryResult {
  rows: Record<string, unknown>[];
  viz_type: 'table' | 'bar_chart' | 'line_chart' | 'pie_chart' | 'number';
  title: string;
  insight: string | null;
  x_key: string | null;
  y_key: string | null;
  columns: Column[];
  sql: string;
  execution_time_ms: number;
}

interface AIHistoryItem {
  id: string;
  prompt: string;
  title: string | null;
  viz_type: string | null;
  status: string;
  created_at: string;
}

interface Props {
  websiteId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  aiUsage?: { current: number; limit: number; canCreate: boolean };
}

// ─── Domain config ────────────────────────────────────────────────────────────

interface DomainConfig {
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  suggestions: { label: string; icon: React.ElementType; color: string }[];
}

const DOMAIN_CONFIG: Record<AIDomain, DomainConfig> = {
  analytics: {
    label: 'Analytics', icon: BarChart2, color: 'text-indigo-400', bgColor: 'bg-indigo-500/15',
    suggestions: [
      { label: 'Top 10 pages this week',      icon: BarChart2,    color: 'text-violet-400' },
      { label: 'Visitors by country',         icon: Globe,        color: 'text-cyan-400'   },
      { label: 'Device type breakdown',       icon: Monitor,      color: 'text-emerald-400'},
      { label: 'Daily pageviews this month',  icon: TrendingUp,   color: 'text-indigo-400' },
      { label: 'Top referrers',               icon: ArrowUpRight, color: 'text-amber-400'  },
      { label: 'Browser share',               icon: MousePointer, color: 'text-pink-400'   },
      { label: 'Sessions per OS',             icon: Hash,         color: 'text-sky-400'    },
      { label: 'UTM campaign performance',    icon: Zap,          color: 'text-orange-400' },
    ],
  },
  revenue: {
    label: 'Revenue', icon: DollarSign, color: 'text-emerald-400', bgColor: 'bg-emerald-500/15',
    suggestions: [
      { label: 'Total revenue this month',        icon: DollarSign,  color: 'text-emerald-400' },
      { label: 'Daily revenue trend last 30 days',icon: TrendingUp,  color: 'text-indigo-400'  },
      { label: 'Revenue by country',              icon: Globe,       color: 'text-cyan-400'    },
      { label: 'Top products by revenue',         icon: BarChart2,   color: 'text-violet-400'  },
      { label: 'Revenue by UTM source',           icon: ArrowUpRight,color: 'text-amber-400'   },
      { label: 'Refund rate this month',          icon: Hash,        color: 'text-red-400'     },
      { label: 'Average order value',             icon: Zap,         color: 'text-orange-400'  },
      { label: 'Revenue by device type',          icon: Monitor,     color: 'text-pink-400'    },
    ],
  },
  replays: {
    label: 'Replays', icon: Video, color: 'text-violet-400', bgColor: 'bg-violet-500/15',
    suggestions: [
      { label: 'Total recorded sessions',          icon: Video,       color: 'text-violet-400'  },
      { label: 'Sessions with rage clicks',        icon: Zap,         color: 'text-red-400'     },
      { label: 'Average session duration',         icon: TrendingUp,  color: 'text-indigo-400'  },
      { label: 'Sessions by device type',          icon: Monitor,     color: 'text-emerald-400' },
      { label: 'Sessions with errors',             icon: AlertCircle, color: 'text-orange-400'  },
      { label: 'Top entry pages by session count', icon: BarChart2,   color: 'text-cyan-400'    },
      { label: 'Sessions per country',             icon: Globe,       color: 'text-sky-400'     },
      { label: 'Daily sessions this week',         icon: Hash,        color: 'text-pink-400'    },
    ],
  },
  heatmaps: {
    label: 'Heatmaps', icon: Flame, color: 'text-orange-400', bgColor: 'bg-orange-500/15',
    suggestions: [
      { label: 'Top pages by total click intensity', icon: Flame,      color: 'text-orange-400' },
      { label: 'Most clicked elements this week',    icon: MousePointer,color:'text-amber-400'  },
      { label: 'Click distribution by device type',  icon: Monitor,    color: 'text-emerald-400'},
      { label: 'Scroll depth by page',               icon: ArrowUpRight,color:'text-indigo-400' },
      { label: 'Click heatmap for homepage',         icon: BarChart2,  color: 'text-violet-400' },
      { label: 'Mobile vs desktop click patterns',   icon: Hash,       color: 'text-cyan-400'   },
      { label: 'Top clicked selectors on /pricing',  icon: Zap,        color: 'text-pink-400'   },
      { label: 'Pages with most interactions',       icon: TrendingUp, color: 'text-sky-400'    },
    ],
  },
  funnels: {
    label: 'Funnels', icon: Filter, color: 'text-cyan-400', bgColor: 'bg-cyan-500/15',
    suggestions: [
      { label: 'List all active funnels',          icon: Filter,      color: 'text-cyan-400'    },
      { label: 'Total funnel completions this month',icon: TrendingUp, color: 'text-indigo-400' },
      { label: 'Funnel completions per day',        icon: BarChart2,   color: 'text-violet-400' },
      { label: 'Funnel completion rate',            icon: Hash,        color: 'text-emerald-400'},
      { label: 'Most active funnels by completions',icon: Zap,         color: 'text-amber-400'  },
      { label: 'Funnel completions by device',      icon: Monitor,     color: 'text-pink-400'   },
      { label: 'Funnel completions by country',     icon: Globe,       color: 'text-sky-400'    },
      { label: 'Weekly funnel trend',               icon: TrendingUp,  color: 'text-orange-400' },
    ],
  },
  automations: {
    label: 'Automations', icon: Bot, color: 'text-pink-400', bgColor: 'bg-pink-500/15',
    suggestions: [
      { label: 'List all active automations',         icon: Bot,         color: 'text-pink-400'    },
      { label: 'Total automation runs this month',    icon: Hash,        color: 'text-indigo-400'  },
      { label: 'Automation success vs failure rate',  icon: BarChart2,   color: 'text-violet-400'  },
      { label: 'Runs per automation ranked',          icon: TrendingUp,  color: 'text-emerald-400' },
      { label: 'Daily automation triggers this week', icon: Zap,         color: 'text-amber-400'   },
      { label: 'Failed automation runs today',        icon: AlertCircle, color: 'text-red-400'     },
      { label: 'Most triggered automations',          icon: ArrowUpRight,color: 'text-cyan-400'    },
      { label: 'Average execution duration (ms)',     icon: Monitor,     color: 'text-sky-400'     },
    ],
  },
};

const DOMAIN_ORDER: AIDomain[] = ['analytics', 'revenue', 'replays', 'heatmaps', 'funnels', 'automations'];

const CHART_COLORS = ['#818cf8', '#22d3ee', '#34d399', '#fb923c', '#f472b6', '#a78bfa', '#38bdf8', '#4ade80'];

// ─── Charts ───────────────────────────────────────────────────────────────────

function NumberCard({ rows, yKey, title }: { rows: Record<string, unknown>[]; yKey: string | null; title: string }) {
  const key = yKey ?? Object.keys(rows[0] ?? {})[0] ?? 'value';
  const value = rows[0]?.[key];
  const formatted = typeof value === 'number' ? value.toLocaleString() : String(value ?? '—');
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <p className="text-8xl font-bold text-indigo-400">{formatted}</p>
      <p className="text-base text-muted-foreground">{title}</p>
    </div>
  );
}

function ResultBarChart({ rows, xKey, yKey, columns, height = 320 }: { rows: Record<string, unknown>[]; xKey: string | null; yKey: string | null; columns: Column[]; height?: number }) {
  const xk = xKey ?? columns[0]?.key ?? 'name';
  const yk = yKey ?? columns[1]?.key ?? 'count';
  const data = rows.slice(0, 20).map((r) => ({ ...r, [xk]: String(r[xk] ?? '').slice(0, 28) }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 32, top: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.5)" horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey={xk} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} width={120} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
          cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
        />
        <Bar dataKey={yk} fill="#6366f1" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function ResultLineChart({ rows, xKey, yKey, columns, height = 320 }: { rows: Record<string, unknown>[]; xKey: string | null; yKey: string | null; columns: Column[]; height?: number }) {
  const xk = xKey ?? columns[0]?.key ?? 'day';
  const yk = yKey ?? columns[1]?.key ?? 'count';
  const data = rows.map((r) => ({ ...r, [xk]: typeof r[xk] === 'string' ? (r[xk] as string).slice(0, 10) : r[xk] }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ left: 0, right: 16, top: 8, bottom: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" />
        <XAxis dataKey={xk} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
        />
        <Line type="monotone" dataKey={yk} stroke="#818cf8" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: '#818cf8', strokeWidth: 0 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function ResultPieChart({ rows, xKey, yKey, columns, height = 320 }: { rows: Record<string, unknown>[]; xKey: string | null; yKey: string | null; columns: Column[]; height?: number }) {
  const nameKey = xKey ?? columns[0]?.key ?? 'name';
  const valueKey = yKey ?? columns[1]?.key ?? 'count';
  const data = rows.slice(0, 8).map((r) => ({ name: String(r[nameKey] ?? ''), value: Number(r[valueKey] ?? 0) }));
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="flex items-center gap-8 h-full">
      <ResponsiveContainer width="55%" height={height}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="40%" outerRadius="75%" paddingAngle={2}>
            {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} strokeWidth={0} />)}
          </Pie>
          <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex-1 space-y-3 min-w-0">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-3 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
            <span className="truncate text-muted-foreground flex-1">{d.name}</span>
            <span className="font-semibold text-foreground shrink-0">
              {total > 0 ? `${((d.value / total) * 100).toFixed(1)}%` : d.value.toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ResultTable({ rows, columns }: { rows: Record<string, unknown>[]; columns: Column[] }) {
  return (
    <div className="overflow-auto rounded-xl border border-border/60 text-sm h-full">
      <table className="w-full">
        <thead className="sticky top-0 bg-muted">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className="px-4 py-3 text-left font-semibold text-muted-foreground whitespace-nowrap uppercase tracking-wide text-xs">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-muted/30 transition-colors">
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3 text-foreground/90 whitespace-nowrap">
                  {String(row[col.key] ?? '—')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Result Modal (80 × 80) ───────────────────────────────────────────────────

function AIResultModal({ result, open, onOpenChange, onNewQuery, prompt }: {
  result: AIQueryResult;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onNewQuery: () => void;
  prompt: string;
}) {
  const { rows, viz_type, title, insight, x_key, y_key, columns, execution_time_ms } = result;

  const chartHeight = 420;

  const chart = (() => {
    if (!rows.length) return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground">
        <BarChart2 className="h-10 w-10 opacity-20" />
        <p className="text-sm">No data returned for this query.</p>
      </div>
    );
    switch (viz_type) {
      case 'number':     return <NumberCard rows={rows} yKey={y_key} title={title} />;
      case 'bar_chart':  return <ResultBarChart rows={rows} xKey={x_key} yKey={y_key} columns={columns} height={chartHeight} />;
      case 'line_chart': return <ResultLineChart rows={rows} xKey={x_key} yKey={y_key} columns={columns} height={chartHeight} />;
      case 'pie_chart':  return <ResultPieChart rows={rows} xKey={x_key} yKey={y_key} columns={columns} height={chartHeight} />;
      default:           return <ResultTable rows={rows} columns={columns} />;
    }
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[80vw] max-w-[80vw] h-[80vh] rounded-2xl sm:rounded-2xl p-0 overflow-hidden gap-0 border border-border shadow-2xl [&>button:last-child]:hidden flex flex-col">
        <DialogTitle className="sr-only">{title}</DialogTitle>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-4 pb-4 border-b border-border/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/15">
              <TrendingUp className="h-4 w-4 text-indigo-400" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground flex items-center gap-2">
                {title}
                <span className="rounded-md bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-bold text-indigo-400 tracking-wide shrink-0">AI</span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {rows.length} row{rows.length !== 1 ? 's' : ''} · {execution_time_ms}ms · <span className="font-mono">{viz_type}</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onNewQuery}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> New query
            </button>
            <button
              onClick={() => onOpenChange(false)}
              className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Chart area */}
        <div className="flex-1 min-h-0 px-6 py-5 overflow-auto">
          <div className="h-full">
            {chart}
          </div>
        </div>

        {/* Insight footer */}
        {insight && (
          <div className="shrink-0 border-t border-border/50 px-6 py-3 flex items-start gap-3">
            <Sparkles className="h-4 w-4 text-indigo-400 shrink-0 mt-0.5" />
            <p className="text-sm text-foreground/80 leading-relaxed">{insight}</p>
          </div>
        )}

        {/* Prompt context */}
        <div className="shrink-0 border-t border-border/40 bg-muted/20 px-6 py-2.5 flex items-center gap-2">
          <span className="text-[11px] text-muted-foreground/50 font-medium uppercase tracking-wide">Query</span>
          <span className="text-[11px] text-muted-foreground truncate">{prompt}</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Demo / preview data ──────────────────────────────────────────────────────

const DEMO_RESULTS: Record<string, AIQueryResult> = {
  // Analytics
  bar_chart: {
    viz_type: 'bar_chart', title: 'Top 8 Pages by Views', insight: 'The homepage accounts for over 40% of all traffic. Blog posts drive the next largest share.',
    x_key: 'page', y_key: 'views', execution_time_ms: 42, sql: '',
    columns: [{ key: 'page', label: 'Page' }, { key: 'views', label: 'Views' }],
    rows: [
      { page: '/', views: 4821 }, { page: '/pricing', views: 2103 },
      { page: '/blog/getting-started', views: 1874 }, { page: '/docs', views: 1432 },
      { page: '/features', views: 987 }, { page: '/about', views: 654 },
      { page: '/blog/analytics-tips', views: 521 }, { page: '/contact', views: 318 },
    ],
  },
  line_chart: {
    viz_type: 'line_chart', title: 'Daily Pageviews — Last 14 Days', insight: 'A spike on the 8th correlates with the product launch announcement. Weekend dips are consistent.',
    x_key: 'day', y_key: 'views', execution_time_ms: 38, sql: '',
    columns: [{ key: 'day', label: 'Date' }, { key: 'views', label: 'Views' }],
    rows: [
      { day: '2026-04-28', views: 1240 }, { day: '2026-04-29', views: 980 },
      { day: '2026-04-30', views: 870 },  { day: '2026-05-01', views: 1540 },
      { day: '2026-05-02', views: 1720 }, { day: '2026-05-03', views: 900 },
      { day: '2026-05-04', views: 760 },  { day: '2026-05-05', views: 1650 },
      { day: '2026-05-06', views: 2100 }, { day: '2026-05-07', views: 1980 },
      { day: '2026-05-08', views: 3420 }, { day: '2026-05-09', views: 2860 },
      { day: '2026-05-10', views: 2100 }, { day: '2026-05-11', views: 1750 },
    ],
  },
  pie_chart: {
    viz_type: 'pie_chart', title: 'Sessions by Device Type', insight: 'Mobile now exceeds desktop for the first time. Consider prioritising mobile UX improvements.',
    x_key: 'device', y_key: 'sessions', execution_time_ms: 29, sql: '',
    columns: [{ key: 'device', label: 'Device' }, { key: 'sessions', label: 'Sessions' }],
    rows: [
      { device: 'Mobile', sessions: 5821 }, { device: 'Desktop', sessions: 5104 },
      { device: 'Tablet', sessions: 1032 }, { device: 'Other', sessions: 143 },
    ],
  },
  number: {
    viz_type: 'number', title: 'Unique Visitors This Month', insight: 'Up 18% compared to last month. Growth is primarily from organic search.',
    x_key: null, y_key: 'visitors', execution_time_ms: 12, sql: '',
    columns: [{ key: 'visitors', label: 'Visitors' }],
    rows: [{ visitors: 24_871 }],
  },
  table: {
    viz_type: 'table', title: 'Top Referrers Last 30 Days', insight: 'Google accounts for nearly half of all referred traffic. Twitter referrals have grown 34% MoM.',
    x_key: null, y_key: null, execution_time_ms: 55, sql: '',
    columns: [
      { key: 'source', label: 'Source' }, { key: 'visitors', label: 'Visitors' },
      { key: 'bounce_rate', label: 'Bounce %' }, { key: 'avg_duration', label: 'Avg. Time' },
    ],
    rows: [
      { source: 'google.com',       visitors: 8_420, bounce_rate: '42%', avg_duration: '2m 14s' },
      { source: 'twitter.com',      visitors: 3_102, bounce_rate: '61%', avg_duration: '1m 08s' },
      { source: 'github.com',       visitors: 1_874, bounce_rate: '38%', avg_duration: '3m 42s' },
      { source: 'producthunt.com',  visitors: 1_543, bounce_rate: '55%', avg_duration: '1m 55s' },
      { source: 'linkedin.com',     visitors: 987,   bounce_rate: '48%', avg_duration: '2m 01s' },
    ],
  },
  // Revenue
  revenue_line: {
    viz_type: 'line_chart', title: 'Daily Revenue — Last 14 Days', insight: 'Revenue peaked mid-month after a promotional campaign. Weekend drops are normal for B2B products.',
    x_key: 'day', y_key: 'revenue', execution_time_ms: 44, sql: '',
    columns: [{ key: 'day', label: 'Date' }, { key: 'revenue', label: 'Revenue ($)' }],
    rows: [
      { day: '2026-04-28', revenue: 1240 }, { day: '2026-04-29', revenue: 980 },
      { day: '2026-04-30', revenue: 1120 }, { day: '2026-05-01', revenue: 2400 },
      { day: '2026-05-02', revenue: 3100 }, { day: '2026-05-03', revenue: 1800 },
      { day: '2026-05-04', revenue: 900 },  { day: '2026-05-05', revenue: 2650 },
      { day: '2026-05-06', revenue: 3200 }, { day: '2026-05-07', revenue: 2980 },
      { day: '2026-05-08', revenue: 5420 }, { day: '2026-05-09', revenue: 4260 },
      { day: '2026-05-10', revenue: 3100 }, { day: '2026-05-11', revenue: 2750 },
    ],
  },
  revenue_bar: {
    viz_type: 'bar_chart', title: 'Revenue by Country', insight: 'US accounts for 52% of total revenue. UK and Germany are the fastest growing markets.',
    x_key: 'country', y_key: 'revenue', execution_time_ms: 35, sql: '',
    columns: [{ key: 'country', label: 'Country' }, { key: 'revenue', label: 'Revenue ($)' }],
    rows: [
      { country: 'United States', revenue: 18_420 }, { country: 'United Kingdom', revenue: 6_102 },
      { country: 'Germany', revenue: 4_874 }, { country: 'Canada', revenue: 3_543 },
      { country: 'Australia', revenue: 2_987 }, { country: 'France', revenue: 1_764 },
    ],
  },
  // Replays
  replays_bar: {
    viz_type: 'bar_chart', title: 'Sessions by Browser', insight: 'Chrome leads with 61% of all recorded sessions. Safari on mobile is second at 24%.',
    x_key: 'browser', y_key: 'sessions', execution_time_ms: 31, sql: '',
    columns: [{ key: 'browser', label: 'Browser' }, { key: 'sessions', label: 'Sessions' }],
    rows: [
      { browser: 'Chrome', sessions: 3821 }, { browser: 'Safari', sessions: 1543 },
      { browser: 'Firefox', sessions: 621 }, { browser: 'Edge', sessions: 432 },
      { browser: 'Other', sessions: 183 },
    ],
  },
  replays_number: {
    viz_type: 'number', title: 'Sessions with Rage Clicks', insight: '8.4% of all sessions contain rage clicks. Most are concentrated on the pricing page CTA.',
    x_key: null, y_key: 'value', execution_time_ms: 18, sql: '',
    columns: [{ key: 'value', label: 'Sessions' }],
    rows: [{ value: 512 }],
  },
  // Heatmaps
  heatmaps_bar: {
    viz_type: 'bar_chart', title: 'Top Pages by Click Intensity', insight: 'The /pricing page has 3x the click density of other pages, driven by the plan comparison table.',
    x_key: 'page', y_key: 'clicks', execution_time_ms: 27, sql: '',
    columns: [{ key: 'page', label: 'Page' }, { key: 'clicks', label: 'Total Clicks' }],
    rows: [
      { page: '/pricing', clicks: 12_430 }, { page: '/', clicks: 8_721 },
      { page: '/features', clicks: 5_102 }, { page: '/blog', clicks: 3_654 },
      { page: '/docs', clicks: 2_987 }, { page: '/about', clicks: 1_234 },
    ],
  },
  heatmaps_table: {
    viz_type: 'table', title: 'Top Clicked Elements on /pricing', insight: 'The "Get Started" CTA button gets 34% of all clicks. The pricing toggle gets 18%.',
    x_key: null, y_key: null, execution_time_ms: 41, sql: '',
    columns: [
      { key: 'selector', label: 'Element' }, { key: 'clicks', label: 'Clicks' },
      { key: 'device', label: 'Device' },
    ],
    rows: [
      { selector: 'button.cta-primary', clicks: 4_230, device: 'desktop' },
      { selector: 'input[type="radio"]', clicks: 2_310, device: 'desktop' },
      { selector: 'a.plan-card', clicks: 1_876, device: 'mobile' },
      { selector: 'button.cta-primary', clicks: 1_543, device: 'mobile' },
      { selector: '.faq-accordion', clicks: 987, device: 'desktop' },
    ],
  },
  // Funnels
  funnels_table: {
    viz_type: 'table', title: 'Active Funnels', insight: 'Checkout funnel has the highest completion rate at 34%. Onboarding funnel needs attention.',
    x_key: null, y_key: null, execution_time_ms: 22, sql: '',
    columns: [
      { key: 'name', label: 'Funnel' }, { key: 'completions', label: 'Completions' },
      { key: 'is_active', label: 'Active' },
    ],
    rows: [
      { name: 'Checkout Flow', completions: 1_243, is_active: 'Yes' },
      { name: 'Onboarding', completions: 876, is_active: 'Yes' },
      { name: 'Upgrade Path', completions: 432, is_active: 'Yes' },
      { name: 'Feature Adoption', completions: 218, is_active: 'No' },
    ],
  },
  funnels_line: {
    viz_type: 'line_chart', title: 'Funnel Completions Per Day', insight: 'Completions correlate with email campaign sends. Spikes on Tuesdays and Thursdays.',
    x_key: 'day', y_key: 'completions', execution_time_ms: 39, sql: '',
    columns: [{ key: 'day', label: 'Date' }, { key: 'completions', label: 'Completions' }],
    rows: [
      { day: '2026-05-05', completions: 54 }, { day: '2026-05-06', completions: 87 },
      { day: '2026-05-07', completions: 123 }, { day: '2026-05-08', completions: 45 },
      { day: '2026-05-09', completions: 32 }, { day: '2026-05-10', completions: 98 },
      { day: '2026-05-11', completions: 112 },
    ],
  },
  // Automations
  automations_bar: {
    viz_type: 'bar_chart', title: 'Runs per Automation', insight: 'Welcome Email automation fires most frequently. Low-traffic automations may need trigger threshold review.',
    x_key: 'name', y_key: 'total_runs', execution_time_ms: 48, sql: '',
    columns: [{ key: 'name', label: 'Automation' }, { key: 'total_runs', label: 'Total Runs' }],
    rows: [
      { name: 'Welcome Email', total_runs: 2_430 }, { name: 'Cart Abandonment', total_runs: 1_876 },
      { name: 'Re-engagement', total_runs: 987 }, { name: 'Upsell Trigger', total_runs: 654 },
      { name: 'Churn Prevention', total_runs: 321 },
    ],
  },
  automations_table: {
    viz_type: 'table', title: 'Automation Performance', insight: 'Welcome Email has a 96% success rate. Cart Abandonment has elevated failures — check webhook logs.',
    x_key: null, y_key: null, execution_time_ms: 52, sql: '',
    columns: [
      { key: 'name', label: 'Automation' }, { key: 'runs', label: 'Runs' },
      { key: 'success', label: 'Success' }, { key: 'failed', label: 'Failed' },
      { key: 'success_rate', label: 'Success %' },
    ],
    rows: [
      { name: 'Welcome Email',    runs: 2_430, success: 2_340, failed: 90,  success_rate: '96.3%' },
      { name: 'Cart Abandonment', runs: 1_876, success: 1_543, failed: 333, success_rate: '82.2%' },
      { name: 'Re-engagement',    runs: 987,   success: 965,   failed: 22,  success_rate: '97.8%' },
      { name: 'Upsell Trigger',   runs: 654,   success: 641,   failed: 13,  success_rate: '98.0%' },
    ],
  },
};

// Demo buttons per domain
const DEMO_BUTTONS_BY_DOMAIN: Record<AIDomain, { key: string; label: string; desc: string }[]> = {
  analytics: [
    { key: 'bar_chart',  label: 'Bar chart',   desc: 'Top pages' },
    { key: 'line_chart', label: 'Line chart',  desc: 'Daily trend' },
    { key: 'pie_chart',  label: 'Pie / donut', desc: 'Device split' },
    { key: 'number',     label: 'Number card', desc: 'Single KPI' },
    { key: 'table',      label: 'Table',       desc: 'Referrers' },
  ],
  revenue: [
    { key: 'revenue_line', label: 'Line chart', desc: 'Daily revenue' },
    { key: 'revenue_bar',  label: 'Bar chart',  desc: 'By country' },
  ],
  replays: [
    { key: 'replays_bar',    label: 'Bar chart',   desc: 'By browser' },
    { key: 'replays_number', label: 'Number card', desc: 'Rage clicks' },
  ],
  heatmaps: [
    { key: 'heatmaps_bar',   label: 'Bar chart', desc: 'Click intensity' },
    { key: 'heatmaps_table', label: 'Table',     desc: 'Top elements' },
  ],
  funnels: [
    { key: 'funnels_table', label: 'Table',      desc: 'Active funnels' },
    { key: 'funnels_line',  label: 'Line chart', desc: 'Completions/day' },
  ],
  automations: [
    { key: 'automations_bar',   label: 'Bar chart', desc: 'Runs per auto.' },
    { key: 'automations_table', label: 'Table',     desc: 'Performance' },
  ],
};

// Random demo result for a domain
function randomDemoResult(domain: AIDomain): AIQueryResult {
  const buttons = DEMO_BUTTONS_BY_DOMAIN[domain];
  const { key } = buttons[Math.floor(Math.random() * buttons.length)];
  return DEMO_RESULTS[key];
}

// ─── Main Command Modal ───────────────────────────────────────────────────────

export function AICommandModal({ websiteId, open, onOpenChange, aiUsage }: Props) {
  const [domain, setDomain] = useState<AIDomain>('analytics');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIQueryResult | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<AIHistoryItem[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isDemoMode = websiteId === 'demo';

  const limitReached = aiUsage && !aiUsage.canCreate;
  const unlimited = aiUsage?.limit === -1;
  const usagePct = aiUsage && !unlimited ? Math.min(100, (aiUsage.current / aiUsage.limit) * 100) : 0;
  const isNearLimit = usagePct >= 80;
  const isAtLimit = usagePct >= 100;

  const domainCfg = DOMAIN_CONFIG[domain];

  const openResult = useCallback((r: AIQueryResult) => {
    setResult(r);
    setResultOpen(true);
    onOpenChange(false);
  }, [onOpenChange]);

  const handleNewQuery = useCallback(() => {
    setResultOpen(false);
    setResult(null);
    setPrompt('');
    onOpenChange(true);
  }, [onOpenChange]);

  const fetchHistory = useCallback(async () => {
    if (isDemoMode) return;
    try {
      const res = await api.get(`/ai/history/${websiteId}?limit=5`);
      setHistory(res.data.data ?? []);
    } catch { /* non-critical */ }
  }, [websiteId, isDemoMode]);

  const runQuery = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);
    try {
      if (isDemoMode) {
        await new Promise((r) => setTimeout(r, 1200));
        openResult(randomDemoResult(domain));
      } else {
        const res = await api.post(`/ai/query/${websiteId}`, { prompt: trimmed, domain });
        const data = res.data.data as AIQueryResult;
        fetchHistory();
        openResult(data);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setError(msg.includes('LIMIT_REACHED')
        ? 'Monthly limit reached. Upgrade your plan to run more AI queries.'
        : msg);
    } finally {
      setLoading(false);
    }
  }, [loading, websiteId, isDemoMode, domain, fetchHistory, openResult]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    runQuery(prompt);
  }, [prompt, runQuery]);

  const handleSuggestion = useCallback((s: string) => {
    setPrompt(s);
    runQuery(s);
  }, [runQuery]);

  useEffect(() => {
    if (open) {
      setTimeout(() => textareaRef.current?.focus(), 60);
      setError(null);
      fetchHistory();
    }
  }, [open, fetchHistory]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (resultOpen) { setResultOpen(false); return; }
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, resultOpen, onOpenChange]);

  const showIdle = !loading && !error;
  const showDemoPreviews = isDemoMode || process.env.NODE_ENV !== 'production';

  return (
    <>
      {/* ── Command / Input modal ── */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[640px] rounded-2xl sm:rounded-2xl p-0 overflow-hidden gap-0 border border-border shadow-2xl [&>button:last-child]:hidden">
          <DialogTitle className="sr-only">Seentics AI</DialogTitle>

          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-4 pb-3.5 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className={cn('flex h-7 w-7 items-center justify-center rounded-lg', domainCfg.bgColor)}>
                <Sparkles className={cn('h-4 w-4', domainCfg.color)} />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Seentics AI</p>
                <p className="text-[11px] text-muted-foreground leading-none mt-0.5">Ask anything about your data</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {aiUsage && !isDemoMode && (
                <div className={cn(
                  'flex items-center gap-2 rounded-full border px-3 py-1 text-xs',
                  isAtLimit   ? 'border-red-500/30 bg-red-500/10 text-red-400'
                  : isNearLimit ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                  :               'border-border/60 bg-muted/50 text-muted-foreground',
                )}>
                  {unlimited ? (
                    <span>{aiUsage.current} used</span>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-14 rounded-full bg-border overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all', isAtLimit ? 'bg-red-400' : isNearLimit ? 'bg-amber-400' : 'bg-indigo-400')}
                          style={{ width: `${usagePct}%` }}
                        />
                      </div>
                      <span>{aiUsage.current} / {aiUsage.limit}</span>
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={() => onOpenChange(false)}
                className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Domain tabs */}
          <div className="flex items-center gap-1 px-5 pt-3 pb-1 overflow-x-auto scrollbar-hide">
            {DOMAIN_ORDER.map((d) => {
              const cfg = DOMAIN_CONFIG[d];
              const Icon = cfg.icon;
              const active = d === domain;
              return (
                <button
                  key={d}
                  onClick={() => { setDomain(d); setPrompt(''); setError(null); }}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors shrink-0',
                    active
                      ? cn('border', `border-border/60`, cfg.bgColor, cfg.color)
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                  )}
                >
                  <Icon className="h-3 w-3 shrink-0" />
                  {cfg.label}
                </button>
              );
            })}
          </div>

          {/* Body */}
          <div className="px-5 py-4 space-y-4 max-h-[64vh] overflow-y-auto">

            {limitReached && !isDemoMode && (
              <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3">
                <Lock className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-red-400">Monthly limit reached</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    You&apos;ve used all {aiUsage?.limit} AI analyses. Upgrade to continue.
                  </p>
                </div>
              </div>
            )}

            {/* Input */}
            <form onSubmit={handleSubmit}>
              <div className={cn(
                'relative rounded-xl border bg-muted/30 transition-colors',
                limitReached && !isDemoMode ? 'pointer-events-none opacity-50' : `hover:border-indigo-500/40 focus-within:border-indigo-500/60`,
              )}>
                <textarea
                  ref={textareaRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(e as unknown as React.FormEvent); }
                  }}
                  placeholder={`Ask anything about your ${domainCfg.label.toLowerCase()} data…`}
                  rows={2}
                  maxLength={500}
                  disabled={loading || (!isDemoMode && !!limitReached)}
                  className="w-full resize-none rounded-xl bg-transparent px-4 pt-3.5 pb-11 text-sm placeholder:text-muted-foreground/60 focus:outline-none leading-relaxed"
                />
                <div className="absolute bottom-2.5 left-4 right-2.5 flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground/50">{prompt.length}/500</span>
                  <button
                    type="submit"
                    disabled={!prompt.trim() || loading || (!isDemoMode && !!limitReached)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                      prompt.trim() && !loading && (isDemoMode || !limitReached)
                        ? 'bg-indigo-500 text-white hover:bg-indigo-600'
                        : 'bg-muted text-muted-foreground cursor-not-allowed',
                    )}
                  >
                    {loading
                      ? <><Loader2 className="h-3 w-3 animate-spin" /> Analyzing…</>
                      : <><Send className="h-3 w-3" /> Send</>
                    }
                  </button>
                </div>
              </div>
            </form>

            {/* Idle: suggestions + history + dev/demo preview */}
            {showIdle && (
              <div className="space-y-4">
                <div className="space-y-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                    Quick questions
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {domainCfg.suggestions.map(({ label, icon: Icon, color }) => (
                      <button
                        key={label}
                        onClick={() => handleSuggestion(label)}
                        disabled={!isDemoMode && !!limitReached}
                        className="group flex items-center gap-2.5 rounded-lg border border-border/50 bg-muted/20 px-3 py-2.5 text-left text-xs text-foreground/80 transition-colors hover:border-border hover:bg-muted/50 hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Icon className={cn('h-3.5 w-3.5 shrink-0', color)} />
                        <span className="truncate">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {history.length > 0 && !isDemoMode && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground/60 flex items-center gap-1.5">
                      <History className="h-3 w-3" /> Recent
                    </p>
                    <div className="rounded-xl border border-border/40 divide-y divide-border/30 overflow-hidden">
                      {history.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleSuggestion(item.prompt)}
                          disabled={!!limitReached}
                          className="group w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-muted/40 transition-colors disabled:opacity-40"
                        >
                          <RotateCcw className="h-3 w-3 shrink-0 text-muted-foreground/50 group-hover:text-indigo-400 transition-colors" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs text-foreground/80 group-hover:text-foreground transition-colors">{item.prompt}</p>
                            {item.title && item.title !== item.prompt && (
                              <p className="truncate text-[10px] text-muted-foreground mt-0.5">{item.title}</p>
                            )}
                          </div>
                          <span className={cn(
                            'shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-md',
                            item.status === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-400',
                          )}>
                            {item.status === 'success' ? (item.viz_type ?? '✓') : '✗'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dev / Demo previews */}
                {showDemoPreviews && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-500/70 flex items-center gap-1.5">
                      <span className="inline-flex items-center rounded px-1 py-0.5 bg-amber-500/10 text-amber-500 text-[9px] font-bold tracking-wider">
                        {isDemoMode ? 'DEMO' : 'DEV'}
                      </span>
                      Preview components
                    </p>
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 divide-y divide-amber-500/10 overflow-hidden">
                      {DEMO_BUTTONS_BY_DOMAIN[domain].map(({ key, label, desc }) => (
                        <button
                          key={key}
                          onClick={() => openResult(DEMO_RESULTS[key])}
                          className="w-full flex items-center justify-between px-3.5 py-2.5 text-left hover:bg-amber-500/8 transition-colors"
                        >
                          <div>
                            <p className="text-xs font-medium text-foreground/80">{label}</p>
                            <p className="text-[10px] text-muted-foreground">{desc}</p>
                          </div>
                          <span className="text-[10px] text-amber-500/70 font-mono">{key}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="flex flex-col items-center gap-4 rounded-xl border border-border/50 bg-muted/20 px-5 py-10">
                <div className="relative flex h-11 w-11 items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-indigo-500/20 animate-ping" />
                  <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-indigo-500/20">
                    <Sparkles className="h-4 w-4 text-indigo-400" />
                  </div>
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium text-foreground">Analyzing your {domainCfg.label.toLowerCase()} data…</p>
                  <p className="text-xs text-muted-foreground">Generating SQL and processing results</p>
                </div>
                <div className="flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </div>
              </div>
            )}

            {/* Error */}
            {error && !loading && (
              <div className="flex items-start gap-3 rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3.5">
                <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-red-400 leading-snug">{error}</p>
                  <button
                    onClick={() => setError(null)}
                    className="mt-1.5 text-xs text-muted-foreground hover:text-foreground underline transition-colors"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-border/40 bg-muted/20 px-5 py-2 flex items-center gap-3 text-[10px] text-muted-foreground/60">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border/60 bg-background px-1.5 py-0.5 font-mono">↵</kbd> send
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border/60 bg-background px-1.5 py-0.5 font-mono">⇧↵</kbd> newline
            </span>
            <span className="ml-auto flex items-center gap-1">
              <kbd className="rounded border border-border/60 bg-background px-1.5 py-0.5 font-mono">⌘K</kbd> toggle
            </span>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Result modal (80 × 80) ── */}
      {result && (
        <AIResultModal
          result={result}
          open={resultOpen}
          onOpenChange={(v) => { setResultOpen(v); if (!v) setResult(null); }}
          onNewQuery={handleNewQuery}
          prompt={prompt}
        />
      )}
    </>
  );
}
