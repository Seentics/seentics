'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  BarChart, Bar, AreaChart, Area, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList,
} from 'recharts';
import {
  Sparkles, Send, X, Loader2, AlertCircle, TrendingUp,
  Lock, History, RotateCcw, Globe, Monitor, MousePointer,
  BarChart2, Hash, ArrowUpRight, Zap, ArrowLeft,
  DollarSign, Video, Flame, Filter, Bot, Download,
  ChevronDown, ChevronUp, Code2, CheckCircle2, Clock,
  Database, Activity,
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
  tips: string | null;
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

// ─── Constants ────────────────────────────────────────────────────────────────

const CHART_COLORS = [
  '#818cf8', '#22d3ee', '#34d399', '#fb923c',
  '#f472b6', '#a78bfa', '#38bdf8', '#4ade80', '#fbbf24', '#f87171',
];

const LOADING_STEPS = [
  { label: 'Routing your question…',     icon: Bot },
  { label: 'Generating SQL query…',      icon: Code2 },
  { label: 'Running on your data…',      icon: Database },
];

const GLOBAL_SUGGESTIONS = [
  { label: 'Top 10 pages this week',          icon: BarChart2,    color: 'text-violet-600 dark:text-violet-400',  bg: 'bg-violet-100 dark:bg-violet-500/10' },
  { label: 'Revenue by country last month',   icon: DollarSign,   color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-500/10' },
  { label: 'Sessions with rage clicks',       icon: Zap,          color: 'text-red-600 dark:text-red-400',     bg: 'bg-red-100 dark:bg-red-500/10' },
  { label: 'Daily visitors trend last 14 days', icon: Activity,   color: 'text-indigo-600 dark:text-indigo-400',  bg: 'bg-indigo-100 dark:bg-indigo-500/10' },
  { label: 'Where are users dropping off?',   icon: Filter,       color: 'text-orange-600 dark:text-orange-400',  bg: 'bg-orange-100 dark:bg-orange-500/10' },
  { label: 'Total recorded sessions',         icon: Video,        color: 'text-purple-600 dark:text-purple-400',  bg: 'bg-purple-100 dark:bg-purple-500/10' },
];

// ─── Utilities ────────────────────────────────────────────────────────────────

function formatLabel(label: string, maxLen = 45) {
  const cleaned = label.replace(/^https?:\/\/[^/]+/, '');
  if (!cleaned || cleaned === '/') return '/';
  if (cleaned.length <= maxLen) return cleaned;
  return `${cleaned.slice(0, 18)}…${cleaned.slice(-20)}`;
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'number') return val.toLocaleString();
  const s = String(val);
  // Trim ISO timestamps to date only
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
  return s;
}

function exportCSV(rows: Record<string, unknown>[], columns: Column[], title: string) {
  const header = columns.map((c) => `"${c.label}"`).join(',');
  const body = rows.map((r) =>
    columns.map((c) => {
      const v = r[c.key] ?? '';
      return `"${String(v).replace(/"/g, '""')}"`;
    }).join(','),
  );
  const csv = [header, ...body].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/\s+/g, '-').toLowerCase()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Chart Components ─────────────────────────────────────────────────────────

function NumberCard({ rows, yKey, title, insight }: {
  rows: Record<string, unknown>[];
  yKey: string | null;
  title: string;
  insight?: string | null;
}) {
  const key = yKey ?? Object.keys(rows[0] ?? {})[0] ?? 'value';
  const raw = rows[0]?.[key];
  const num = typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''));
  const formatted = isNaN(num) ? String(raw ?? '—') : num.toLocaleString();

  return (
    <div className="flex flex-col items-center justify-center min-h-[220px] gap-4 py-8">
      <div className="relative flex items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-indigo-400/15 blur-3xl scale-150 dark:bg-indigo-500/10" />
        <span className="relative text-7xl sm:text-8xl font-black bg-gradient-to-br from-indigo-500 via-violet-500 to-indigo-700 bg-clip-text text-transparent tabular-nums dark:from-indigo-300 dark:via-violet-300 dark:to-indigo-500">
          {formatted}
        </span>
      </div>
      <p className="text-base font-semibold text-foreground">{title}</p>
      {insight && (
        <p className="max-w-sm text-center text-sm text-muted-foreground leading-relaxed">
          {insight}
        </p>
      )}
    </div>
  );
}

/** Renders a 1-row multi-column result as a grid of stat cards instead of a boring single-row table. */
function StatGrid({ rows, columns }: { rows: Record<string, unknown>[]; columns: Column[] }) {
  const row = rows[0] ?? {};
  return (
    <div className={cn(
      'grid h-full gap-3 content-start',
      columns.length <= 2 ? 'grid-cols-2' :
      columns.length <= 4 ? 'grid-cols-2 sm:grid-cols-4' :
      'grid-cols-2 sm:grid-cols-3',
    )}>
      {columns.map((col, i) => {
        const raw = row[col.key];
        const num = typeof raw === 'number' ? raw : parseFloat(String(raw ?? ''));
        const display = isNaN(num) ? String(raw ?? '—') : num.toLocaleString();
        const color = CHART_COLORS[i % CHART_COLORS.length];
        return (
          <div
            key={col.key}
            className="relative overflow-hidden rounded-lg border border-border bg-muted/40 p-4 flex flex-col gap-2 dark:bg-muted/20"
          >
            <div className="absolute top-0 right-0 h-16 w-16 rounded-lg-bl-full opacity-10" style={{ background: color }} />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{col.label}</p>
            <p className="text-2xl sm:text-3xl font-bold text-foreground tabular-nums" style={{ color }}>
              {display}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function ResultBarChart({ rows, xKey, yKey, columns }: {
  rows: Record<string, unknown>[];
  xKey: string | null;
  yKey: string | null;
  columns: Column[];
}) {
  const xk = xKey ?? columns[0]?.key ?? 'name';
  const yk = yKey ?? columns[1]?.key ?? 'count';
  const data = rows.slice(0, 20).map((r) => ({ ...r, [xk]: String(r[xk] ?? '') }));
  const perRowPx = 48;
  const chartH = Math.max(220, data.length * perRowPx + 40);

  // Dynamic label column: measure longest truncated label, cap at 200px
  const maxLabelLen = Math.max(...data.map((d) => formatLabel(String(d[xk] ?? ''), 32).length));
  const labelW = Math.min(200, Math.max(60, maxLabelLen * 6.5));

  return (
    <div style={{ height: chartH }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 0, right: 10, top: 4, bottom: 4 }}>
          <defs>
            <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.85} />
              <stop offset="100%" stopColor="#818cf8" stopOpacity={0.65} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false} tickLine={false} allowDecimals={false}
            domain={[0, 'dataMax']}
          />
          <YAxis
            type="category" dataKey={xk} width={labelW} axisLine={false} tickLine={false} interval={0}
            tick={({ x, y, payload }) => (
              <g transform={`translate(${x},${y})`}>
                <text x={-8} y={0} dy={4} textAnchor="end"
                  fill="hsl(var(--muted-foreground))" fontSize={11}>
                  {formatLabel(payload.value, 32)}
                </text>
              </g>
            )}
          />
          <Tooltip
            contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 10, fontSize: 12, boxShadow: '0 8px 24px rgb(0 0 0 / 0.12)' }}
            labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600, marginBottom: 4 }}
            cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
            formatter={(v: number) => [v.toLocaleString(), columns.find((c) => c.key === yk)?.label ?? 'Value'] as [string, string]}
          />
          <Bar dataKey={yk} fill="url(#barGrad)" radius={[0, 5, 5, 0]} barSize={26}>
            <LabelList
              dataKey={yk}
              position="right"
              style={{ fill: 'hsl(var(--foreground) / 0.7)', fontSize: 11, fontWeight: 600 }}
              formatter={(v: unknown) => typeof v === 'number' ? v.toLocaleString() : String(v)}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function ResultAreaChart({ rows, xKey, yKey, columns }: {
  rows: Record<string, unknown>[];
  xKey: string | null;
  yKey: string | null;
  columns: Column[];
}) {
  const xk = xKey ?? columns[0]?.key ?? 'day';
  const yk = yKey ?? columns[1]?.key ?? 'count';
  const data = rows.map((r) => ({
    ...r,
    [xk]: typeof r[xk] === 'string' ? (r[xk] as string).slice(0, 10) : r[xk],
  }));

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: 0, right: 16, top: 16, bottom: 4 }}>
          <defs>
            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"  stopColor="#6366f1" stopOpacity={0.25} />
              <stop offset="75%" stopColor="#6366f1" stopOpacity={0.04} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" vertical={false} />
          <XAxis
            dataKey={xk}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false} tickLine={false}
            tickMargin={8}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false} tickLine={false} width={52}
            tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : v}
          />
          <Tooltip
            contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 10, fontSize: 12, boxShadow: '0 8px 24px rgb(0 0 0 / 0.12)' }}
            labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600, marginBottom: 4 }}
            formatter={(v: number) => [v.toLocaleString(), columns.find((c) => c.key === yk)?.label ?? 'Value'] as [string, string]}
            cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1, strokeDasharray: '4 4' }}
          />
          <Area
            type="monotone" dataKey={yk}
            stroke="#6366f1" strokeWidth={2.5}
            fill="url(#areaGrad)"
            dot={false}
            activeDot={{ r: 5, fill: '#6366f1', stroke: 'hsl(var(--background))', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ResultLineChart({ rows, xKey, yKey, columns }: {
  rows: Record<string, unknown>[];
  xKey: string | null;
  yKey: string | null;
  columns: Column[];
}) {
  const xk = xKey ?? columns[0]?.key ?? 'day';
  const yk = yKey ?? columns[1]?.key ?? 'count';
  const data = rows.map((r) => ({
    ...r,
    [xk]: typeof r[xk] === 'string' ? (r[xk] as string).slice(0, 10) : r[xk],
  }));

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: 0, right: 16, top: 16, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border) / 0.4)" vertical={false} />
          <XAxis
            dataKey={xk}
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false} tickLine={false} tickMargin={8}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
            axisLine={false} tickLine={false} width={52}
            tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : v}
          />
          <Tooltip
            contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 10, fontSize: 12, boxShadow: '0 8px 24px rgb(0 0 0 / 0.12)' }}
            labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600, marginBottom: 4 }}
            formatter={(v: number) => [v.toLocaleString(), columns.find((c) => c.key === yk)?.label ?? 'Value'] as [string, string]}
            cursor={{ stroke: 'hsl(var(--border))', strokeWidth: 1, strokeDasharray: '4 4' }}
          />
          <Line
            type="monotone" dataKey={yk}
            stroke="#6366f1" strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 5, fill: '#6366f1', stroke: 'hsl(var(--background))', strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function ResultPieChart({ rows, xKey, yKey, columns }: {
  rows: Record<string, unknown>[];
  xKey: string | null;
  yKey: string | null;
  columns: Column[];
}) {
  const nameKey = xKey ?? columns[0]?.key ?? 'name';
  const valueKey = yKey ?? columns[1]?.key ?? 'count';
  const data = rows.slice(0, 8).map((r) => ({
    name: String(r[nameKey] ?? ''),
    value: Number(r[valueKey] ?? 0),
  }));
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-10 min-h-[280px]">
      <div className="w-full sm:w-[44%] h-56 sm:h-64 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <defs>
              {CHART_COLORS.map((c, i) => (
                <radialGradient key={i} id={`pieGrad${i}`} cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor={c} stopOpacity={1} />
                  <stop offset="100%" stopColor={c} stopOpacity={0.8} />
                </radialGradient>
              ))}
            </defs>
            <Pie data={data} dataKey="value" nameKey="name"
              cx="50%" cy="50%" innerRadius="40%" outerRadius="75%" paddingAngle={2}>
              {data.map((_, i) => (
                <Cell key={i} fill={`url(#pieGrad${i % CHART_COLORS.length})`} strokeWidth={0} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 10, fontSize: 12, boxShadow: '0 8px 24px rgb(0 0 0 / 0.12)' }}
              formatter={(v: number, _: unknown, entry: { name?: string }) => [v.toLocaleString(), entry?.name ?? ''] as [string, string]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex-1 space-y-2 w-full min-w-0">
        {data.map((d, i) => {
          const pct = total > 0 ? (d.value / total) * 100 : 0;
          return (
            <div key={i} className="space-y-1">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                  <span className="truncate text-foreground/80 text-xs font-medium">{d.name}</span>
                </div>
                <div className="shrink-0 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground tabular-nums">{d.value.toLocaleString()}</span>
                  <span className="text-xs font-bold tabular-nums" style={{ color: CHART_COLORS[i % CHART_COLORS.length] }}>
                    {pct.toFixed(1)}%
                  </span>
                </div>
              </div>
              <div className="h-1.5 w-full rounded-full bg-border/50 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${pct}%`, background: CHART_COLORS[i % CHART_COLORS.length] }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ResultTable({ rows, columns }: { rows: Record<string, unknown>[]; columns: Column[] }) {
  return (
    <div className="overflow-auto rounded-lg border border-border text-sm">
      <table className="w-full border-collapse">
        <thead>
          <tr className="sticky top-0 z-10 bg-muted dark:bg-muted/80 backdrop-blur-sm">
            {columns.map((col) => (
              <th key={col.key}
                className="px-4 py-3 text-left font-semibold text-muted-foreground whitespace-nowrap text-[11px] uppercase tracking-wider border-b border-border">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={cn(
              'transition-colors hover:bg-muted/50',
              i % 2 === 0 ? 'bg-transparent' : 'bg-muted/30',
            )}>
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-2.5 text-foreground/90 whitespace-nowrap border-b border-border text-sm">
                  {formatValue(row[col.key])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Result Modal ─────────────────────────────────────────────────────────────

function AIResultModal({ result, open, onOpenChange, onNewQuery, prompt }: {
  result: AIQueryResult;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onNewQuery: () => void;
  prompt: string;
}) {
  const { rows, viz_type, title, insight, tips, x_key, y_key, columns, sql, execution_time_ms } = result;
  const [sqlOpen, setSqlOpen] = useState(false);
  const tipList = tips ? tips.split('\n').filter((t) => t.trim().length > 0) : [];
  const hasInsights = !!(insight || tipList.length > 0);

  // Auto-detect if 1-row multi-column → render StatGrid
  const useStatGrid = viz_type === 'table' && rows.length === 1 && columns.length >= 2 && columns.length <= 6;

  // Use AreaChart for line_chart when data looks temporal (x values contain dates)
  const isTemporalData = rows.length > 0 && x_key &&
    /^\d{4}-\d{2}-\d{2}/.test(String(rows[0]?.[x_key] ?? ''));

  const chart = (() => {
    if (!rows.length) return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
        <div className="rounded-full border border-border bg-muted/50 p-5">
          <BarChart2 className="h-8 w-8 opacity-40" />
        </div>
        <div className="text-center">
          <p className="text-sm font-medium">No data returned</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Try adjusting your query or date range</p>
        </div>
      </div>
    );
    if (useStatGrid)   return <StatGrid rows={rows} columns={columns} />;
    switch (viz_type) {
      case 'number':     return <NumberCard rows={rows} yKey={y_key} title={title} insight={insight} />;
      case 'bar_chart':  return <ResultBarChart rows={rows} xKey={x_key} yKey={y_key} columns={columns} />;
      case 'line_chart': return isTemporalData
        ? <ResultAreaChart rows={rows} xKey={x_key} yKey={y_key} columns={columns} />
        : <ResultLineChart rows={rows} xKey={x_key} yKey={y_key} columns={columns} />;
      case 'pie_chart':  return <ResultPieChart rows={rows} xKey={x_key} yKey={y_key} columns={columns} />;
      default:           return <ResultTable rows={rows} columns={columns} />;
    }
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(
        'flex flex-col p-0 gap-0 overflow-hidden rounded-lg sm:rounded-lg border border-border shadow-2xl',
        'bg-background',
        'w-[96vw] max-w-[1160px] h-[92vh]',
        '[&>button:last-child]:hidden',
      )}>
        <DialogTitle className="sr-only">{title}</DialogTitle>

        {/* ── Header ── */}
        <div className="shrink-0 flex items-start sm:items-center justify-between gap-3 px-4 sm:px-6 pt-4 pb-3.5 border-b border-border">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div className="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-100 to-violet-100 border border-indigo-200 dark:from-indigo-500/20 dark:to-violet-500/20 dark:border-indigo-500/20">
              <TrendingUp className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm sm:text-base font-semibold text-foreground leading-tight">{title}</p>
                <span className="shrink-0 rounded-lg bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-600 tracking-wide dark:bg-indigo-500/15 dark:text-indigo-400">AI</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
                  <Database className="h-3 w-3" />
                  {rows.length} row{rows.length !== 1 ? 's' : ''}
                </span>
                <span className="text-muted-foreground/30">·</span>
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground/70">
                  <Clock className="h-3 w-3" />
                  {execution_time_ms}ms
                </span>
                <span className="text-muted-foreground/30">·</span>
                <span className="rounded-lg bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/70">
                  {useStatGrid ? 'stat_grid' : viz_type}
                </span>
              </div>
            </div>
          </div>

          <div className="shrink-0 flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => exportCSV(rows, columns, title)}
              title="Download CSV"
              className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">CSV</span>
            </button>
            <button
              onClick={onNewQuery}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">New query</span>
            </button>
            <button
              onClick={() => onOpenChange(false)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ── Body: chart full-width, insights below ── */}
        <div className="flex-1 min-h-0 overflow-auto">

          {/* Chart — full modal width */}
          <div className="p-4 sm:p-6 pb-2">
            <div className={cn('w-full', viz_type === 'number' ? 'min-h-[220px]' : '')}>
              {chart}
            </div>
          </div>

          {/* Insights row — two cards side by side below chart */}
          {hasInsights && viz_type !== 'number' && (
            <div className="px-4 sm:px-6 pb-5 pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-border mt-2">
              {insight && (
                <div className="rounded-lg border border-border bg-muted/40 p-4 dark:bg-muted/20">
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-500/15">
                      <Bot className="h-3 w-3 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600/80 dark:text-indigo-400/80">Key Insight</p>
                  </div>
                  <p className="text-sm text-foreground/80 leading-relaxed">{insight}</p>
                </div>
              )}

              {tipList.length > 0 && (
                <div className="rounded-lg border border-border bg-muted/40 p-4 dark:bg-muted/20">
                  <div className="flex items-center gap-2 mb-2.5">
                    <div className="flex h-5 w-5 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-500/15">
                      <Zap className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600/80 dark:text-amber-400/80">Improvement Tips</p>
                  </div>
                  <div className="space-y-2">
                    {tipList.map((tip, i) => (
                      <div key={i} className="flex gap-2.5 text-xs text-foreground/70 leading-relaxed">
                        <span className="shrink-0 mt-1.5 h-1.5 w-1.5 rounded-full bg-amber-500/50" />
                        <span>{tip.replace(/^[•\-*]\s*/, '')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer: prompt + SQL viewer ── */}
        <div className="shrink-0 border-t border-border bg-muted/50 dark:bg-muted/20">
          {/* Prompt bar */}
          <div className="flex items-center gap-2 px-4 sm:px-6 py-2.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Query</span>
            <span className="flex-1 truncate text-[11px] text-muted-foreground/80">{prompt}</span>
            {sql && (
              <button
                onClick={() => setSqlOpen(!sqlOpen)}
                className="shrink-0 flex items-center gap-1 text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
              >
                <Code2 className="h-3 w-3" />
                <span className="hidden sm:inline">SQL</span>
                {sqlOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
            )}
          </div>

          {/* SQL drawer */}
          {sqlOpen && sql && (
            <div className="border-t border-border px-4 sm:px-6 py-3 bg-muted/60 dark:bg-muted/30 max-h-36 overflow-auto">
              <pre className="text-[11px] text-foreground/70 font-mono leading-relaxed whitespace-pre-wrap break-all">
                {sql}
              </pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Demo / preview data ──────────────────────────────────────────────────────

const DEMO_RESULTS: Record<string, AIQueryResult> = {
  bar_chart: {
    viz_type: 'bar_chart', title: 'Top 8 Pages by Views',
    insight: 'The homepage accounts for over 40% of all traffic. Blog posts drive the next largest share.',
    tips: '• Speed up homepage load time — each 100ms delay reduces conversions by ~1%.\n• Add more internal links to lower-performing pages to distribute traffic.\n• Consider a featured posts section on the homepage to boost blog discovery.',
    x_key: 'page', y_key: 'views', execution_time_ms: 42,
    sql: "SELECT page, COUNT(*) AS views FROM analytics_events WHERE website_id = $1 AND event_type = 'pageview' GROUP BY page ORDER BY views DESC LIMIT 8",
    columns: [{ key: 'page', label: 'Page' }, { key: 'views', label: 'Views' }],
    rows: [
      { page: '/', views: 4821 }, { page: '/pricing', views: 2103 },
      { page: '/blog/getting-started', views: 1874 }, { page: '/docs', views: 1432 },
      { page: '/features', views: 987 }, { page: '/about', views: 654 },
      { page: '/blog/analytics-tips', views: 521 }, { page: '/contact', views: 318 },
    ],
  },
  line_chart: {
    viz_type: 'line_chart', title: 'Daily Pageviews — Last 14 Days',
    insight: 'A spike on the 8th correlates with a product launch announcement. Weekend dips are consistent.',
    tips: '• Publish content on Mondays to capture early-week traffic surges.\n• Schedule social posts for Sunday evenings to cushion weekend dips.\n• Investigate the May 8th spike source to replicate that promotion.',
    x_key: 'day', y_key: 'views', execution_time_ms: 38,
    sql: "SELECT date_trunc('day', occurred_at) AS day, COUNT(*) AS views FROM analytics_events WHERE website_id = $1 AND event_type = 'pageview' AND occurred_at >= NOW() - INTERVAL '14 days' GROUP BY day ORDER BY day",
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
    viz_type: 'pie_chart', title: 'Sessions by Device Type',
    insight: 'Mobile now exceeds desktop for the first time. Consider prioritising mobile UX improvements.',
    tips: '• Audit your mobile checkout flow — high mobile traffic with low conversion is a red flag.\n• Test font sizes and tap target sizes on real devices.\n• Consider AMP pages for your top mobile-traffic blog posts.',
    x_key: 'device', y_key: 'sessions', execution_time_ms: 29,
    sql: "SELECT device, COUNT(DISTINCT session_id) AS sessions FROM analytics_events WHERE website_id = $1 AND event_type = 'pageview' GROUP BY device ORDER BY sessions DESC",
    columns: [{ key: 'device', label: 'Device' }, { key: 'sessions', label: 'Sessions' }],
    rows: [
      { device: 'Mobile', sessions: 5821 }, { device: 'Desktop', sessions: 5104 },
      { device: 'Tablet', sessions: 1032 }, { device: 'Other', sessions: 143 },
    ],
  },
  number: {
    viz_type: 'number', title: 'Unique Visitors This Month',
    insight: 'Up 18% compared to last month. Growth is primarily from organic search.',
    tips: '• Keep publishing SEO content to sustain organic growth.\n• Set up a monthly benchmark report to track this number over time.',
    x_key: null, y_key: 'visitors', execution_time_ms: 12,
    sql: "SELECT COUNT(DISTINCT visitor_id) AS visitors FROM analytics_events WHERE website_id = $1 AND event_type = 'pageview' AND occurred_at >= date_trunc('month', NOW())",
    columns: [{ key: 'visitors', label: 'Visitors' }],
    rows: [{ visitors: 24_871 }],
  },
  table: {
    viz_type: 'table', title: 'Top Referrers Last 30 Days',
    insight: 'Google accounts for nearly half of all referred traffic. Twitter referrals have grown 34% MoM.',
    tips: '• Invest more in GitHub presence — it drives high-intent, low-bounce visitors.\n• Twitter referrals are growing fast — maintain that engagement.\n• Reduce dependence on Google by diversifying to newsletter and community channels.',
    x_key: null, y_key: null, execution_time_ms: 55,
    sql: "SELECT referrer AS source, COUNT(DISTINCT visitor_id) AS visitors FROM analytics_events WHERE website_id = $1 AND event_type = 'pageview' AND referrer IS NOT NULL AND occurred_at >= NOW() - INTERVAL '30 days' GROUP BY referrer ORDER BY visitors DESC LIMIT 10",
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
  stat_grid: {
    viz_type: 'table', title: 'Site Overview This Month',
    insight: 'Strong visitor-to-session ratio indicates high re-engagement. Avg session duration is healthy.',
    tips: '• Your avg session duration of 2m 43s is above industry average — keep it up.\n• A 3.2% bounce rate is excellent; investigate landing pages with higher bounce rates.\n• 47,200 events from 24,871 visitors = ~1.9 events per visitor — try to increase this.',
    x_key: null, y_key: null, execution_time_ms: 28,
    sql: "SELECT COUNT(DISTINCT visitor_id) AS visitors, COUNT(DISTINCT session_id) AS sessions, COUNT(*) AS total_events FROM analytics_events WHERE website_id = $1 AND occurred_at >= date_trunc('month', NOW())",
    columns: [
      { key: 'visitors', label: 'Visitors' }, { key: 'sessions', label: 'Sessions' },
      { key: 'total_events', label: 'Events' }, { key: 'avg_duration', label: 'Avg Duration' },
    ],
    rows: [{ visitors: 24_871, sessions: 31_204, total_events: 47_200, avg_duration: '2m 43s' }],
  },
  revenue_line: {
    viz_type: 'line_chart', title: 'Daily Revenue — Last 14 Days',
    insight: 'Revenue peaked mid-month after a promotional campaign. Weekend drops are normal for B2B products.',
    tips: '• Run promotions on Thursdays/Fridays to capture end-of-week budget decisions.\n• The May 8th spike suggests email campaigns work — scale them.\n• Consider a mid-month flash sale to address the typical dip on the 12th–14th.',
    x_key: 'day', y_key: 'revenue', execution_time_ms: 44,
    sql: "SELECT date_trunc('day', occurred_at) AS day, ROUND(SUM((properties->>'revenue')::numeric), 2) AS revenue FROM analytics_events WHERE website_id = $1 AND event_type IN ('purchase','order_completed') AND occurred_at >= NOW() - INTERVAL '14 days' GROUP BY day ORDER BY day",
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
    viz_type: 'bar_chart', title: 'Revenue by Country',
    insight: 'US accounts for 52% of total revenue. UK and Germany are the fastest growing markets.',
    tips: '• Localise pricing pages for UK and Germany to accelerate growth there.\n• Consider a German-language landing page — Germany is your 3rd largest market.\n• Explore affiliate programs in Australia and France to grow those markets.',
    x_key: 'country', y_key: 'revenue', execution_time_ms: 35,
    sql: "SELECT country, ROUND(SUM((properties->>'revenue')::numeric), 2) AS revenue FROM analytics_events WHERE website_id = $1 AND event_type IN ('purchase','order_completed') GROUP BY country ORDER BY revenue DESC LIMIT 10",
    columns: [{ key: 'country', label: 'Country' }, { key: 'revenue', label: 'Revenue ($)' }],
    rows: [
      { country: 'United States', revenue: 18_420 }, { country: 'United Kingdom', revenue: 6_102 },
      { country: 'Germany', revenue: 4_874 }, { country: 'Canada', revenue: 3_543 },
      { country: 'Australia', revenue: 2_987 }, { country: 'France', revenue: 1_764 },
    ],
  },
  replays_bar: {
    viz_type: 'bar_chart', title: 'Sessions by Browser',
    insight: 'Chrome leads with 61% of all recorded sessions. Safari on mobile is second at 24%.',
    tips: '• Test your key flows in Safari — it handles CSS and JS differently from Chrome.\n• Edge is gaining share; ensure your UI is tested on Chromium-based Edge.\n• Low Firefox share is normal for SaaS but worth a quick compatibility check.',
    x_key: 'browser', y_key: 'sessions', execution_time_ms: 31,
    sql: "SELECT browser, COUNT(*) AS sessions FROM session_replays WHERE website_id = $1 AND sequence = 0 GROUP BY browser ORDER BY sessions DESC",
    columns: [{ key: 'browser', label: 'Browser' }, { key: 'sessions', label: 'Sessions' }],
    rows: [
      { browser: 'Chrome', sessions: 3821 }, { browser: 'Safari', sessions: 1543 },
      { browser: 'Firefox', sessions: 621 }, { browser: 'Edge', sessions: 432 },
      { browser: 'Other', sessions: 183 },
    ],
  },
  replays_number: {
    viz_type: 'number', title: 'Sessions with Rage Clicks',
    insight: '8.4% of all sessions contain rage clicks. Most are concentrated on the pricing page CTA.',
    tips: '• Filter replays by has_rage_clicks=true and watch the top 10 to identify frustrating UI elements.\n• If the CTA button causes rage clicks, check for invisible overlays blocking it.\n• Consider A/B testing a simplified version of the pricing page.',
    x_key: null, y_key: 'value', execution_time_ms: 18,
    sql: "SELECT COUNT(*) AS value FROM session_replays WHERE website_id = $1 AND sequence = 0 AND has_rage_clicks = true",
    columns: [{ key: 'value', label: 'Sessions' }],
    rows: [{ value: 512 }],
  },
  heatmaps_bar: {
    viz_type: 'bar_chart', title: 'Top Pages by Click Intensity',
    insight: 'The /pricing page has 3× the click density of other pages, driven by the plan comparison table.',
    tips: '• High pricing page clicks suggest strong intent — optimise the CTA placement there.\n• /features receives good clicks but may have confusing navigation — watch replays.\n• /blog click intensity is low — add more internal CTAs and related posts.',
    x_key: 'page', y_key: 'clicks', execution_time_ms: 27,
    sql: "SELECT page_path AS page, SUM(intensity) AS clicks FROM heatmap_points WHERE website_id::text = $1 AND event_type = 'click' GROUP BY page_path ORDER BY clicks DESC LIMIT 10",
    columns: [{ key: 'page', label: 'Page' }, { key: 'clicks', label: 'Total Clicks' }],
    rows: [
      { page: '/pricing', clicks: 12_430 }, { page: '/', clicks: 8_721 },
      { page: '/features', clicks: 5_102 }, { page: '/blog', clicks: 3_654 },
      { page: '/docs', clicks: 2_987 }, { page: '/about', clicks: 1_234 },
    ],
  },
  heatmaps_table: {
    viz_type: 'table', title: 'Top Clicked Elements on /pricing',
    insight: 'The "Get Started" CTA button gets 34% of all clicks. The pricing toggle gets 18%.',
    tips: '• The primary CTA is getting clicks — ensure it loads fast and is above the fold.\n• Pricing toggle engagement is high — make it more prominent on mobile.\n• FAQ accordion clicks suggest users have unanswered questions — expand FAQ content.',
    x_key: null, y_key: null, execution_time_ms: 41,
    sql: "SELECT target_selector AS selector, device_type AS device, SUM(intensity) AS clicks FROM heatmap_points WHERE website_id::text = $1 AND event_type = 'click' AND page_path = '/pricing' AND target_selector != '' GROUP BY target_selector, device_type ORDER BY clicks DESC LIMIT 20",
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
  funnels_table: {
    viz_type: 'table', title: 'Active Funnels',
    insight: 'You have 3 active funnels. The Checkout Flow was created most recently.',
    tips: '• Review inactive funnels periodically — they may have valuable historical data.\n• Add a description to each funnel to help teammates understand its purpose.\n• Consider creating a funnel for your onboarding flow if you do not have one.',
    x_key: null, y_key: null, execution_time_ms: 22,
    sql: "SELECT id::text AS id, name, description, is_active, created_at FROM funnels WHERE website_id::text = $1 ORDER BY created_at DESC LIMIT 50",
    columns: [
      { key: 'name', label: 'Funnel' }, { key: 'is_active', label: 'Active' }, { key: 'created_at', label: 'Created' },
    ],
    rows: [
      { name: 'Checkout Flow',     is_active: 'true',  created_at: '2026-05-01T10:00:00Z' },
      { name: 'Onboarding',        is_active: 'true',  created_at: '2026-04-15T09:00:00Z' },
      { name: 'Upgrade Path',      is_active: 'true',  created_at: '2026-03-20T14:00:00Z' },
      { name: 'Feature Adoption',  is_active: 'false', created_at: '2026-02-10T11:00:00Z' },
    ],
  },
  funnels_line: {
    viz_type: 'line_chart', title: 'Funnels Created per Month',
    insight: '4 funnels created this year. Activity peaked in Q1 with new funnel setup after product launch.',
    tips: '• Set a quarterly reminder to audit and archive unused funnels.\n• Create funnels for each major user journey — onboarding, upgrade, re-engagement.\n• Pair funnel data with session replays to diagnose drop-off points.',
    x_key: 'month', y_key: 'count', execution_time_ms: 19,
    sql: "SELECT date_trunc('month', created_at) AS month, COUNT(*) AS count FROM funnels WHERE website_id::text = $1 GROUP BY month ORDER BY month",
    columns: [{ key: 'month', label: 'Month' }, { key: 'count', label: 'Funnels Created' }],
    rows: [
      { month: '2026-02-01', count: 1 }, { month: '2026-03-01', count: 1 },
      { month: '2026-04-01', count: 1 }, { month: '2026-05-01', count: 1 },
    ],
  },
  automations_bar: {
    viz_type: 'bar_chart', title: 'Runs per Automation',
    insight: 'Welcome Email automation fires most frequently. Low-traffic automations may need trigger threshold review.',
    tips: '• Welcome Email fires frequently — make sure it handles deduplication to avoid spamming.\n• Cart Abandonment is your 2nd most active — verify its webhook delivery rate.\n• Churn Prevention has low runs — check if its trigger conditions are too restrictive.',
    x_key: 'name', y_key: 'total_runs', execution_time_ms: 48,
    sql: "SELECT a.name, COUNT(*) AS total_runs FROM automation_events ae JOIN automations a ON ae.automation_id = a.id WHERE a.website_id::text = $1 AND ae.record_type = 'server_run' GROUP BY a.id, a.name ORDER BY total_runs DESC",
    columns: [{ key: 'name', label: 'Automation' }, { key: 'total_runs', label: 'Total Runs' }],
    rows: [
      { name: 'Welcome Email', total_runs: 2_430 }, { name: 'Cart Abandonment', total_runs: 1_876 },
      { name: 'Re-engagement', total_runs: 987 }, { name: 'Upsell Trigger', total_runs: 654 },
      { name: 'Churn Prevention', total_runs: 321 },
    ],
  },
  automations_table: {
    viz_type: 'table', title: 'Automation Performance',
    insight: 'Welcome Email has a 96% success rate. Cart Abandonment has elevated failures — check webhook logs.',
    tips: '• Cart Abandonment 82% success rate is below acceptable threshold — investigate webhook failures.\n• Re-engagement and Upsell have near-perfect rates — use them as references for webhook setup.\n• Set up alert notifications for automations that drop below 90% success rate.',
    x_key: null, y_key: null, execution_time_ms: 52,
    sql: "SELECT a.name, COUNT(*) AS runs, SUM(CASE WHEN ae.status='success' THEN 1 ELSE 0 END) AS successful, SUM(CASE WHEN ae.status='failed' THEN 1 ELSE 0 END) AS failed, ROUND(100.0 * SUM(CASE WHEN ae.status='success' THEN 1 ELSE 0 END) / NULLIF(COUNT(*),0), 2) AS success_rate FROM automation_events ae JOIN automations a ON ae.automation_id = a.id WHERE a.website_id::text = $1 AND ae.record_type = 'server_run' GROUP BY a.id, a.name ORDER BY runs DESC",
    columns: [
      { key: 'name', label: 'Automation' }, { key: 'runs', label: 'Runs' },
      { key: 'successful', label: 'Success' }, { key: 'failed', label: 'Failed' },
      { key: 'success_rate', label: 'Success %' },
    ],
    rows: [
      { name: 'Welcome Email',    runs: 2_430, successful: 2_340, failed: 90,  success_rate: '96.30' },
      { name: 'Cart Abandonment', runs: 1_876, successful: 1_543, failed: 333, success_rate: '82.20' },
      { name: 'Re-engagement',    runs: 987,   successful: 965,   failed: 22,  success_rate: '97.77' },
      { name: 'Upsell Trigger',   runs: 654,   successful: 641,   failed: 13,  success_rate: '97.98' },
    ],
  },
};

const DEMO_BUTTONS_BY_DOMAIN: Record<AIDomain, { key: string; label: string; desc: string }[]> = {
  analytics: [
    { key: 'bar_chart',  label: 'Bar chart',   desc: 'Top pages' },
    { key: 'line_chart', label: 'Area chart',  desc: 'Daily trend' },
    { key: 'pie_chart',  label: 'Pie / donut', desc: 'Device split' },
    { key: 'number',     label: 'Number card', desc: 'Single KPI' },
    { key: 'table',      label: 'Table',       desc: 'Top referrers' },
    { key: 'stat_grid',  label: 'Stat grid',   desc: 'Site overview' },
  ],
  revenue: [
    { key: 'revenue_line', label: 'Area chart', desc: 'Daily revenue' },
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
    { key: 'funnels_line',  label: 'Area chart', desc: 'Created/month' },
  ],
  automations: [
    { key: 'automations_bar',   label: 'Bar chart', desc: 'Runs per auto.' },
    { key: 'automations_table', label: 'Table',     desc: 'Performance' },
  ],
};

function randomDemoResult(domain: AIDomain): AIQueryResult {
  const buttons = DEMO_BUTTONS_BY_DOMAIN[domain];
  const { key } = buttons[Math.floor(Math.random() * buttons.length)];
  return DEMO_RESULTS[key];
}

// ─── Main Command Modal ───────────────────────────────────────────────────────

export function AICommandModal({ websiteId, open, onOpenChange, aiUsage }: Props) {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadStep, setLoadStep] = useState(0);
  const [domain] = useState<AIDomain>('analytics');
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

  // Animate loading steps
  useEffect(() => {
    if (!loading) { setLoadStep(0); return; }
    const ids = LOADING_STEPS.map((_, i) =>
      setTimeout(() => setLoadStep(i), i * 1600),
    );
    return () => ids.forEach(clearTimeout);
  }, [loading]);

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
        await new Promise((r) => setTimeout(r, 3400));
        openResult(randomDemoResult(domain));
      } else {
        const res = await api.post(`/ai/query/${websiteId}`, { prompt: trimmed, domain });
        const data = res.data.data as AIQueryResult;
        fetchHistory();
        openResult(data);
      }
    } catch (err: unknown) {
      // Prefer the backend's error message (axios puts it on response.data.error).
      const ax = err as { response?: { status?: number; data?: { error?: string } }; message?: string };
      const status = ax?.response?.status;
      const backendMsg = ax?.response?.data?.error;
      let msg = backendMsg || ax?.message || 'Something went wrong. Please try again.';
      if (status === 429) {
        msg = backendMsg || 'You have reached the AI query limit. Please try again later.';
      } else if (status === 503) {
        msg = backendMsg || 'AI is temporarily unavailable.';
      } else if ((backendMsg ?? '').includes('LIMIT_REACHED')) {
        msg = 'Monthly limit reached. Upgrade your plan to run more AI queries.';
      }
      setError(msg);
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
      {/* ── Command / Input Modal ── */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className={cn(
          'flex flex-col p-0 gap-0 overflow-hidden rounded-lg sm:rounded-lg',
          'border border-border shadow-2xl',
          'bg-background',
          'w-[calc(100vw-1rem)] max-w-[700px]',
          '[&>button:last-child]:hidden',
        )}>
          <DialogTitle className="sr-only">Seentics AI</DialogTitle>

          {/* Header */}
          <div className="flex items-center justify-between px-4 sm:px-5 pt-4 pb-3.5 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-100 to-violet-100 border border-indigo-200 dark:from-indigo-500/20 dark:to-violet-500/20 dark:border-indigo-500/20">
                <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">Seentics AI</p>
                <p className="text-[11px] text-muted-foreground leading-none mt-0.5">Ask anything about your data</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5">
              {aiUsage && !isDemoMode && (
                <div className={cn(
                  'flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs',
                  isAtLimit   ? 'border-red-300 bg-red-50 text-red-600 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400'
                  : isNearLimit ? 'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400'
                  :               'border-border bg-muted/60 text-muted-foreground',
                )}>
                  {unlimited ? (
                    <span>{aiUsage.current} used</span>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <div className="h-1.5 w-12 rounded-full bg-border overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all', isAtLimit ? 'bg-red-500' : isNearLimit ? 'bg-amber-500' : 'bg-indigo-500')}
                          style={{ width: `${usagePct}%` }}
                        />
                      </div>
                      <span>{aiUsage.current}/{aiUsage.limit}</span>
                    </div>
                  )}
                </div>
              )}
              <button
                onClick={() => onOpenChange(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="px-4 sm:px-5 py-4 space-y-4 max-h-[68vh] overflow-y-auto">

            {/* Limit warning */}
            {limitReached && !isDemoMode && (
              <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 dark:border-red-500/20 dark:bg-red-500/8">
                <Lock className="h-4 w-4 text-red-600 shrink-0 mt-0.5 dark:text-red-400" />
                <div>
                  <p className="text-sm font-medium text-red-700 dark:text-red-400">Monthly limit reached</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    You&apos;ve used all {aiUsage?.limit} AI analyses. Upgrade to continue.
                  </p>
                </div>
              </div>
            )}

            {/* Input */}
            <form onSubmit={handleSubmit}>
              <div className={cn(
                'relative rounded-lg border transition-all duration-200',
                'bg-muted/40 dark:bg-muted/30',
                loading ? 'border-indigo-400 dark:border-indigo-500/40'
                : limitReached && !isDemoMode ? 'pointer-events-none opacity-50'
                : 'border-border hover:border-indigo-400/70 focus-within:border-indigo-500 dark:hover:border-indigo-500/40 dark:focus-within:border-indigo-500/60',
              )}>
                <textarea
                  ref={textareaRef}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit(e as unknown as React.FormEvent);
                    }
                  }}
                  placeholder="Ask anything about your data… e.g. 'Top 10 pages this week'"
                  rows={2}
                  maxLength={500}
                  disabled={loading || (!isDemoMode && !!limitReached)}
                  className="w-full resize-none rounded-lg bg-transparent px-4 pt-3.5 pb-12 text-sm placeholder:text-muted-foreground/50 focus:outline-none leading-relaxed"
                />
                <div className="absolute bottom-2.5 left-4 right-2.5 flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground/60">{prompt.length}/500</span>
                  <button
                    type="submit"
                    disabled={!prompt.trim() || loading || (!isDemoMode && !!limitReached)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all',
                      prompt.trim() && !loading && (isDemoMode || !limitReached)
                        ? 'bg-indigo-500 text-white hover:bg-indigo-600 shadow-sm shadow-indigo-500/20'
                        : 'bg-muted text-muted-foreground cursor-not-allowed',
                    )}
                  >
                    {loading
                      ? <><Loader2 className="h-3 w-3 animate-spin" /> Analyzing…</>
                      : <><Send className="h-3 w-3" /> Ask</>
                    }
                  </button>
                </div>
              </div>
            </form>

            {/* Idle content */}
            {showIdle && (
              <div className="space-y-4">
                {/* Suggestions */}
                <div className="space-y-2">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    Quick questions
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    {GLOBAL_SUGGESTIONS.map(({ label, icon: Icon, color, bg }) => (
                      <button
                        key={label}
                        onClick={() => handleSuggestion(label)}
                        disabled={!isDemoMode && !!limitReached}
                        className="group flex items-center gap-2.5 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-left text-xs text-foreground/80 transition-all hover:border-border hover:bg-muted/70 hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed dark:bg-muted/20 dark:text-foreground/75 dark:hover:bg-muted/50"
                      >
                        <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-lg', bg)}>
                          <Icon className={cn('h-3.5 w-3.5', color)} />
                        </span>
                        <span className="truncate leading-snug">{label}</span>
                        <ArrowUpRight className="ml-auto h-3 w-3 shrink-0 opacity-0 group-hover:opacity-40 transition-opacity" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* History */}
                {history.length > 0 && !isDemoMode && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                      <History className="h-3 w-3" /> Recent
                    </p>
                    <div className="rounded-lg border border-border divide-y divide-border overflow-hidden">
                      {history.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => handleSuggestion(item.prompt)}
                          disabled={!!limitReached}
                          className="group w-full flex items-center gap-3 px-3.5 py-2.5 text-left hover:bg-muted/60 transition-colors disabled:opacity-40"
                        >
                          <RotateCcw className="h-3 w-3 shrink-0 text-muted-foreground/40 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs text-foreground/75 group-hover:text-foreground">{item.prompt}</p>
                            {item.title && item.title !== item.prompt && (
                              <p className="truncate text-[10px] text-muted-foreground/60 mt-0.5">{item.title}</p>
                            )}
                          </div>
                          <span className={cn(
                            'shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-lg',
                            item.status === 'success' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-400',
                          )}>
                            {item.status === 'success' ? (item.viz_type ?? '✓') : '✗'}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Dev/Demo previews */}
                {showDemoPreviews && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-amber-700 flex items-center gap-1.5 dark:text-amber-500/60">
                      <span className="rounded-lg px-1 py-0.5 bg-amber-100 text-amber-700 text-[9px] font-bold tracking-wider dark:bg-amber-500/10 dark:text-amber-500">
                        {isDemoMode ? 'DEMO' : 'DEV'}
                      </span>
                      Preview components
                    </p>
                    <div className="rounded-lg border border-amber-200 bg-amber-50/60 divide-y divide-amber-200 overflow-hidden dark:border-amber-500/20 dark:bg-amber-500/5 dark:divide-amber-500/10">
                      {DEMO_BUTTONS_BY_DOMAIN[domain].map(({ key, label, desc }) => (
                        <button
                          key={key}
                          onClick={() => openResult(DEMO_RESULTS[key])}
                          className="w-full flex items-center justify-between px-3.5 py-2.5 text-left hover:bg-amber-100 transition-colors dark:hover:bg-amber-500/8"
                        >
                          <div>
                            <p className="text-xs font-medium text-foreground/90">{label}</p>
                            <p className="text-[10px] text-muted-foreground">{desc}</p>
                          </div>
                          <span className="text-[10px] text-amber-700/70 font-mono dark:text-amber-500/60">{key}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Loading */}
            {loading && (
              <div className="flex flex-col items-center gap-5 rounded-lg border border-indigo-200 bg-indigo-50/60 px-5 py-8 dark:border-indigo-500/20 dark:bg-indigo-500/5">
                <div className="relative flex h-12 w-12 items-center justify-center">
                  <div className="absolute inset-0 rounded-full bg-indigo-400/20 animate-ping dark:bg-indigo-500/15" style={{ animationDuration: '1.5s' }} />
                  <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-500/20">
                    <Sparkles className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                </div>
                <div className="w-full space-y-3">
                  {LOADING_STEPS.map(({ label, icon: Icon }, i) => {
                    const done = i < loadStep;
                    const active = i === loadStep;
                    return (
                      <div key={i} className={cn(
                        'flex items-center gap-3 text-sm transition-all duration-300',
                        done ? 'text-emerald-600 dark:text-emerald-400' : active ? 'text-foreground' : 'text-muted-foreground/40',
                      )}>
                        <span className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all',
                          done ? 'border-emerald-500/50 bg-emerald-500/15' :
                          active ? 'border-indigo-400 bg-indigo-100 dark:border-indigo-500/60 dark:bg-indigo-500/15' :
                          'border-border bg-transparent',
                        )}>
                          {done
                            ? <CheckCircle2 className="h-3 w-3 text-emerald-500 dark:text-emerald-400" />
                            : active
                              ? <Loader2 className="h-3 w-3 text-indigo-600 animate-spin dark:text-indigo-400" />
                              : <Icon className="h-2.5 w-2.5 opacity-30" />
                          }
                        </span>
                        <span className={cn('text-xs', active && 'font-medium')}>{label}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Error */}
            {error && !loading && (
              <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3.5 dark:border-red-500/20 dark:bg-red-500/8">
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5 dark:text-red-400" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-red-700 leading-snug dark:text-red-400">{error}</p>
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
          <div className="border-t border-border bg-muted/50 px-4 sm:px-5 py-2 flex items-center gap-3 text-[10px] text-muted-foreground dark:bg-muted/20 dark:text-muted-foreground/60">
            <span className="flex items-center gap-1">
              <kbd className="rounded-lg border border-border bg-background shadow-sm px-1.5 py-0.5 font-mono text-foreground/70">↵</kbd>
              <span>send</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded-lg border border-border bg-background shadow-sm px-1.5 py-0.5 font-mono text-foreground/70">⇧↵</kbd>
              <span>newline</span>
            </span>
            <span className="ml-auto flex items-center gap-1">
              <kbd className="rounded-lg border border-border bg-background shadow-sm px-1.5 py-0.5 font-mono text-foreground/70">⌘K</kbd>
              <span>toggle</span>
            </span>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Result Modal ── */}
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
