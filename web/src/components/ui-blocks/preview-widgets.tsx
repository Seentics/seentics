'use client';

import { useState } from 'react';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Layout, Copy, Check, Code2, Eye, Users, TrendingUp, Globe, Zap, ExternalLink, Search, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The small previews shown beside each embeddable block.
 *
 * Fixed sample numbers on purpose: this is a catalogue of what a block looks like, not a
 * live reading, and a preview that fetched would make the page depend on data it is not
 * about.
 */
export function LiveVisitorsBadge({ count = 142 }: { count?: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 text-sm font-medium">
      <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
      {count.toLocaleString()} live
    </span>
  );
}

export function PageViewsBadge({ views = '12.4k' }: { views?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
      <Eye className="h-3.5 w-3.5" />
      {views} views today
    </span>
  );
}

export function MiniSparkline() {
  const vals = [30, 45, 28, 60, 75, 55, 80, 65, 90, 72, 85, 95];
  const max = Math.max(...vals);
  const h = 32;
  const w = 96;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * w},${h - (v / max) * h}`).join(' ');
  return (
    <div className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card">
      <TrendingUp className="h-3.5 w-3.5 text-green-500 shrink-0" />
      <svg width={w} height={h} className="overflow-visible">
        <polyline points={pts} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-xs font-semibold text-green-600">+18%</span>
    </div>
  );
}

export function StatsWidget() {
  return (
    <div className="inline-grid grid-cols-3 gap-px rounded-lg border border-border overflow-hidden bg-border text-sm">
      {[
        { icon: Users, label: 'Visitors', value: '8,421' },
        { icon: Eye,   label: 'Pageviews', value: '24.6k' },
        { icon: Zap,   label: 'Events',    value: '3,190' },
      ].map(s => (
        <div key={s.label} className="bg-card px-4 py-3 flex flex-col items-center gap-1">
          <s.icon className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="font-bold text-foreground leading-none">{s.value}</p>
          <p className="text-[10px] text-muted-foreground">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

export function TopPagesWidget() {
  const pages = [
    { url: '/', views: 4120 },
    { url: '/pricing', views: 1870 },
    { url: '/docs', views: 1340 },
    { url: '/blog', views: 980 },
  ];
  const max = pages[0].views;
  return (
    <div className="rounded-lg border border-border bg-card p-4 w-64 space-y-3">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">Top Pages</p>
      {pages.map(p => (
        <div key={p.url} className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono text-foreground">{p.url}</span>
            <span className="text-muted-foreground">{p.views.toLocaleString()}</span>
          </div>
          <div className="h-1 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary rounded-full" style={{ width: `${(p.views / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CountryWidget() {
  const rows = [
    { flag: '🇺🇸', country: 'United States', pct: 38 },
    { flag: '🇬🇧', country: 'United Kingdom', pct: 14 },
    { flag: '🇩🇪', country: 'Germany',        pct: 11 },
    { flag: '🇫🇷', country: 'France',          pct: 8 },
  ];
  return (
    <div className="rounded-lg border border-border bg-card p-4 w-64 space-y-2">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Top Countries</p>
      {rows.map(r => (
        <div key={r.country} className="flex items-center gap-2 text-xs">
          <span className="text-base leading-none">{r.flag}</span>
          <span className="flex-1 text-foreground truncate">{r.country}</span>
          <div className="flex items-center gap-2">
            <div className="w-16 h-1 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary/70 rounded-full" style={{ width: `${r.pct}%` }} />
            </div>
            <span className="text-muted-foreground w-6 text-right">{r.pct}%</span>
          </div>
        </div>
      ))}
    </div>
  );
}
