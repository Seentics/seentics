'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Layout, Copy, Check, Code2, Eye, Users, TrendingUp, Globe, Zap, ExternalLink, Search, Filter } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';


import { CodeBlock } from '@/components/ui-blocks/CodeBlock';
import { buildBlocks, CATEGORIES, type Block, CATEGORY_COLORS } from '@/features/ui-blocks/catalogue';

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
        websiteId={websiteId}
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
                'h-7 px-3 rounded-lg text-xs font-medium capitalize transition-colors',
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
            <Badge className={cn('text-[10px] px-1.5 py-0 h-4 border rounded-lg font-normal', CATEGORY_COLORS[cat])}>
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
                        <Badge className={cn('text-[10px] px-1.5 py-0 h-4 border rounded-lg font-normal capitalize shrink-0', CATEGORY_COLORS[block.category])}>
                          {block.category}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{block.description}</p>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {block.tags.map(t => (
                          <span key={t} className="text-[10px] font-mono px-1.5 py-0.5 rounded-lg bg-muted text-muted-foreground border border-border">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-5 space-y-4">
                  {/* Preview */}
                  <div className="flex items-center justify-center min-h-[80px] rounded-lg bg-muted/20 border border-border p-4">
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
            Include this once per page to enable all <code className="font-mono bg-muted px-1 py-0.5 rounded-lg">data-seentics</code> attributes:
          </p>
          <CodeBlock code={`<script src="https://cdn.seentics.com/embed.js" data-project="${websiteId}" async></script>`} />
        </CardContent>
      </Card>
    </div>
  );
}
