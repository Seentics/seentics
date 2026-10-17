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
 * The data-seentics widgets need an embed.js that is not published yet, so they are listed
 * as coming soon with no code. The full-dashboard embed is a link with a token, made on the
 * Agency page's Embeds tab; the React blocks are @seentics/ui, used from source (/docs/ui-blocks).
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
  /**
   * False for a block whose code depends on something not shipped yet (the embed.js
   * widgets): the page shows it as coming soon and offers no code to paste, because a
   * snippet that loads a script that does not exist fails silently on the customer's site.
   */
  available:   boolean;
  /** Where the block is actually set up, when that is not a copy-paste. */
  setup?:      { label: string; href: string };
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
      available: false,
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
      available: false,
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
      available: false,
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
      available: false,
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
      available: false,
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
      available: false,
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
      available: true,
      setup: { label: 'Create embed link', href: '/agency/websites' },
      code: `<!-- Create the link in the Agency workspace: it carries the token the embed needs. -->
<iframe
  src="EMBED_LINK_FROM_AGENCY_WORKSPACE"
  width="100%"
  height="600"
  frameborder="0"
></iframe>`,
    },
    {
      id: 'react-component',
      name: 'React Components',
      description: 'Render your data in your own React app with @seentics/ui (used from source until it is on npm).',
      category: 'embed',
      tags: ['react', 'typescript'],
      preview: (
        <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 font-mono text-xs text-foreground/80 space-y-0.5">
          <p><span className="text-purple-500">import</span> {'{'} AnalyticsSummary {'}'} <span className="text-purple-500">from</span> <span className="text-green-600">&apos;@seentics/ui&apos;</span></p>
          <p className="mt-1"><span className="text-blue-500">{'<AnalyticsSummary'}</span> <span className="text-blue-500">{'/>'}</span></p>
        </div>
      ),
      available: true,
      setup: { label: 'Read the guide', href: '/docs/ui-blocks' },
      code: `// @seentics/ui is not on npm yet: build it from the Seentics repo (ui/blocks)
// and install the folder — see /docs/ui-blocks.
import { SeenticsProvider, AnalyticsSummary, TrafficChart } from '@seentics/ui';

export function Dashboard() {
  return (
    <SeenticsProvider
      websiteId="${websiteId}"
      apiKey={process.env.SEENTICS_API_KEY!}
      apiHost="https://api.seentics.com"
    >
      <AnalyticsSummary />
      <TrafficChart granularity="daily" />
    </SeenticsProvider>
  );
}`,
    },
  ];
}
