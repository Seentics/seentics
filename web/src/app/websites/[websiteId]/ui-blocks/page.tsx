'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Layout, Copy, Check, Code2, Eye, BarChart3,
  Users, TrendingUp, Activity, Globe, Zap,
  ExternalLink, Search, Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useParams as useParamsHook } from 'next/navigation';

interface Block {
  id:          string;
  name:        string;
  description: string;
  category:    'embed' | 'badge' | 'chart' | 'widget';
  tags:        string[];
  preview:     React.ReactNode;
  code:        string;
}

const CATEGORY_COLORS: Record<string, string> = {
  embed:  'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300',
  badge:  'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300',
  chart:  'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300',
  widget: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300',
};

function LiveVisitorsBadge({ count = 142 }: { count?: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300 text-sm font-medium">
      <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
      {count.toLocaleString()} live
    </span>
  );
}

function PageViewsBadge({ views = '12.4k' }: { views?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
      <Eye className="h-3.5 w-3.5" />
      {views} views today
    </span>
  );
}

function MiniSparkline() {
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

function StatsWidget() {
  return (
    <div className="inline-grid grid-cols-3 gap-px rounded-xl border border-border overflow-hidden bg-border text-sm">
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

function TopPagesWidget() {
  const pages = [
    { url: '/', views: 4120 },
    { url: '/pricing', views: 1870 },
    { url: '/docs', views: 1340 },
    { url: '/blog', views: 980 },
  ];
  const max = pages[0].views;
  return (
    <div className="rounded-xl border border-border bg-card p-4 w-64 space-y-3">
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

function CountryWidget() {
  const rows = [
    { flag: '🇺🇸', country: 'United States', pct: 38 },
    { flag: '🇬🇧', country: 'United Kingdom', pct: 14 },
    { flag: '🇩🇪', country: 'Germany',        pct: 11 },
    { flag: '🇫🇷', country: 'France',          pct: 8 },
  ];
  return (
    <div className="rounded-xl border border-border bg-card p-4 w-64 space-y-2">
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

function buildBlocks(websiteId: string): Block[] {
  return [
    {
      id: 'live-visitors-badge',
      name: 'Live Visitors Badge',
      description: 'Real-time active visitor count with animated pulse indicator.',
      category: 'badge',
      tags: ['realtime', 'inline'],
      preview: <LiveVisitorsBadge />,
      code: `<script src="https://cdn.seentics.com/embed.js" data-project="${websiteId}" async></script>
<div
  data-seentics="live-visitors"
  data-project="${websiteId}"
  data-style="badge"
></div>`,
    },
    {
      id: 'pageviews-badge',
      name: 'Page Views Badge',
      description: 'Today\'s page view count — great for landing pages or marketing sites.',
      category: 'badge',
      tags: ['pageviews', 'inline'],
      preview: <PageViewsBadge />,
      code: `<script src="https://cdn.seentics.com/embed.js" data-project="${websiteId}" async></script>
<div
  data-seentics="pageviews"
  data-project="${websiteId}"
  data-period="today"
  data-style="badge"
></div>`,
    },
    {
      id: 'sparkline',
      name: 'Traffic Sparkline',
      description: 'Compact 7-day traffic trend line — inline, lightweight, and responsive.',
      category: 'chart',
      tags: ['chart', 'trend', 'inline'],
      preview: <MiniSparkline />,
      code: `<script src="https://cdn.seentics.com/embed.js" data-project="${websiteId}" async></script>
<div
  data-seentics="sparkline"
  data-project="${websiteId}"
  data-metric="pageviews"
  data-period="7d"
  data-width="120"
  data-height="40"
></div>`,
    },
    {
      id: 'stats-widget',
      name: 'Stats Widget',
      description: '3-column summary strip: visitors, pageviews, and events.',
      category: 'widget',
      tags: ['stats', 'summary'],
      preview: <StatsWidget />,
      code: `<script src="https://cdn.seentics.com/embed.js" data-project="${websiteId}" async></script>
<div
  data-seentics="stats"
  data-project="${websiteId}"
  data-metrics="visitors,pageviews,events"
  data-period="today"
></div>`,
    },
    {
      id: 'top-pages-widget',
      name: 'Top Pages Widget',
      description: 'Ranked list of your most viewed pages with a relative bar chart.',
      category: 'widget',
      tags: ['pages', 'list'],
      preview: <TopPagesWidget />,
      code: `<script src="https://cdn.seentics.com/embed.js" data-project="${websiteId}" async></script>
<div
  data-seentics="top-pages"
  data-project="${websiteId}"
  data-limit="5"
  data-period="7d"
></div>`,
    },
    {
      id: 'country-widget',
      name: 'Country Breakdown',
      description: 'Top countries by visitor share with flag icons and progress bars.',
      category: 'widget',
      tags: ['geo', 'countries'],
      preview: <CountryWidget />,
      code: `<script src="https://cdn.seentics.com/embed.js" data-project="${websiteId}" async></script>
<div
  data-seentics="countries"
  data-project="${websiteId}"
  data-limit="5"
  data-period="30d"
></div>`,
    },
    {
      id: 'full-embed',
      name: 'Full Dashboard Embed',
      description: 'Embed the complete Seentics analytics dashboard inside any iframe.',
      category: 'embed',
      tags: ['iframe', 'full'],
      preview: (
        <div className="rounded-lg border-2 border-dashed border-border flex items-center justify-center w-48 h-24 text-muted-foreground/50 text-xs gap-2">
          <Layout className="h-4 w-4" /> iframe embed
        </div>
      ),
      code: `<iframe
  src="https://app.seentics.com/embed/${websiteId}"
  width="100%"
  height="600"
  frameborder="0"
  allow="clipboard-read; clipboard-write"
></iframe>`,
    },
    {
      id: 'react-component',
      name: 'React Component',
      description: 'Install the @seentics/react package and use typed React components.',
      category: 'embed',
      tags: ['react', 'npm', 'typescript'],
      preview: (
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 font-mono text-xs text-foreground/80 space-y-0.5">
          <p><span className="text-purple-500">import</span> {'{'} SeenticsStats {'}'} <span className="text-purple-500">from</span> <span className="text-green-600">&apos;@seentics/react&apos;</span></p>
          <p className="mt-1"><span className="text-blue-500">{'<SeenticsStats'}</span></p>
          <p className="pl-3 text-muted-foreground">{`projectId="${websiteId}"`}</p>
          <p><span className="text-blue-500">{'/>'}</span></p>
        </div>
      ),
      code: `# Install
npm install @seentics/react

# Usage
import { SeenticsStats, SeenticsLiveCount } from '@seentics/react';

export default function Page() {
  return (
    <>
      <SeenticsLiveCount projectId="${websiteId}" />
      <SeenticsStats
        projectId="${websiteId}"
        metrics={['visitors', 'pageviews']}
        period="7d"
      />
    </>
  );
}`,
    },
  ];
}

const CATEGORIES = ['all', 'badge', 'chart', 'widget', 'embed'] as const;

function CodeBlock({ code }: { code: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    toast({ title: 'Copied to clipboard' });
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group">
      <pre className="text-xs font-mono bg-muted/50 border border-border rounded-lg px-4 py-3 text-foreground/90 overflow-x-auto whitespace-pre leading-relaxed">
        {code}
      </pre>
      <button
        onClick={copy}
        className="absolute top-2 right-2 h-7 w-7 flex items-center justify-center rounded-md border border-border bg-card text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-all"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

export default function UiBlocksPage() {
  const params = useParams();
  const websiteId = params?.websiteId as string;

  const [category, setCategory] = useState<typeof CATEGORIES[number]>('all');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const blocks = buildBlocks(websiteId);

  const filtered = blocks.filter(b => {
    if (category !== 'all' && b.category !== category) return false;
    if (search) {
      const q = search.toLowerCase();
      return b.name.toLowerCase().includes(q) ||
             b.description.toLowerCase().includes(q) ||
             b.tags.some(t => t.includes(q));
    }
    return true;
  });

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-[1100px] mx-auto">
      <DashboardPageHeader
        title="UI Blocks"
        description="Copy-paste embeddable analytics widgets, badges, and charts for your product."
      >
        <a
          href="https://docs.seentics.com/ui-blocks"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          Full docs
        </a>
      </DashboardPageHeader>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search blocks..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          {CATEGORIES.map(c => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                'h-7 px-3 rounded-md text-xs font-medium capitalize transition-colors',
                category === c
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground',
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-6 mb-6 px-1">
        {Object.entries(
          blocks.reduce<Record<string, number>>((acc, b) => {
            acc[b.category] = (acc[b.category] ?? 0) + 1;
            return acc;
          }, {})
        ).map(([cat, count]) => (
          <button
            key={cat}
            onClick={() => setCategory(cat as typeof CATEGORIES[number])}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Badge className={cn('text-[10px] px-1.5 py-0 h-4 border rounded font-normal', CATEGORY_COLORS[cat])}>
              {cat}
            </Badge>
            <span>{count}</span>
          </button>
        ))}
      </div>

      {/* Blocks grid */}
      {filtered.length === 0 ? (
        <div className="py-16 text-center">
          <Layout className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No blocks match your search.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(block => {
            const expanded = expandedId === block.id;
            return (
              <Card key={block.id} className="border border-border overflow-hidden">
                <CardHeader className="px-5 py-4 border-b border-border">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-sm font-semibold">{block.name}</CardTitle>
                        <Badge className={cn('text-[10px] px-1.5 py-0 h-4 border rounded font-normal capitalize shrink-0', CATEGORY_COLORS[block.category])}>
                          {block.category}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{block.description}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {block.tags.map(t => (
                          <span key={t} className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-5 space-y-4">
                  {/* Preview */}
                  <div className="flex items-center justify-center min-h-[80px] rounded-lg bg-muted/20 border border-border/50 p-4">
                    {block.preview}
                  </div>

                  {/* Action row */}
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1.5 text-xs flex-1"
                      onClick={() => setExpandedId(expanded ? null : block.id)}
                    >
                      <Code2 className="h-3 w-3" />
                      {expanded ? 'Hide Code' : 'Show Code'}
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 gap-1.5 text-xs"
                      onClick={async () => {
                        await navigator.clipboard.writeText(block.code);
                      }}
                    >
                      <Copy className="h-3 w-3" />
                      Copy
                    </Button>
                  </div>

                  {/* Expanded code */}
                  {expanded && <CodeBlock code={block.code} />}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* CDN info */}
      <Card className="border border-border mt-6">
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            CDN Embed Script
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            Include this once per page to enable all <code className="font-mono bg-muted px-1 py-0.5 rounded">data-seentics</code> attributes:
          </p>
          <CodeBlock code={`<script src="https://cdn.seentics.com/embed.js" data-project="${websiteId}" async></script>`} />
        </CardContent>
      </Card>
    </div>
  );
}
