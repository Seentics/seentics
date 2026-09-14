'use client';

import { useState } from 'react';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Layout, Copy, Check, Code2, Eye, Users, TrendingUp, Globe, Zap, ExternalLink, Search, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  LiveVisitorsBadge, PageViewsBadge, MiniSparkline,
  StatsWidget, TopPagesWidget, CountryWidget,
} from '@/components/ui-blocks/preview-widgets';

/**
 * Every embeddable block, with its snippet and preview.
 *
 * A function of `websiteId` because each snippet embeds it. Out of the page so the
 * catalogue can back a docs page or a public gallery without copying 130 lines of
 * snippets — several of which contain their own `export default function Page`, which is
 * worth knowing before grepping this file for boundaries.
 */
export const CATEGORIES = ['all', 'badge', 'chart', 'widget', 'embed'] as const;

export interface Block {
  id:          string;
  name:        string;
  description: string;
  category:    'embed' | 'badge' | 'chart' | 'widget';
  tags:        string[];
  preview:     React.ReactNode;
  code:        string;
}

export const CATEGORY_COLORS: Record<string, string> = {
  embed:  'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300',
  badge:  'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300',
  chart:  'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-300',
  widget: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950 dark:text-orange-300',
};

export function buildBlocks(websiteId: string): Block[] {
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
