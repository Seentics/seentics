'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { cn } from '@/lib/utils';
import type { AutomationDefinition } from '@/components/automations/AutomationBuilder';

const TPL_KEY = 'snc_auto_tpl';

import { TEMPLATES, CATEGORIES, type Template } from '@/features/automations/templates';

export default function AutomationTemplatesPage() {
  const params    = useParams();
  const router    = useRouter();
  const websiteId = params?.websiteId as string;

  const [activeCategory, setActiveCategory] = useState('All');

  const filtered = activeCategory === 'All'
    ? TEMPLATES
    : TEMPLATES.filter(t => t.category === activeCategory);

  const useTemplate = (tpl: Template) => {
    try {
      localStorage.setItem(TPL_KEY, JSON.stringify({ name: tpl.name, definition: tpl.definition }));
    } catch { /* private mode */ }
    router.push(`/websites/${websiteId}/automations/new`);
  };

  return (
    <div className="w-full max-w-[1440px] mx-auto p-4 md:p-6 lg:p-8">
      <div className="flex items-center gap-3 mb-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => router.push(`/websites/${websiteId}/automations`)}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Automations
        </Button>
      </div>

      <DashboardPageHeader
        websiteId={websiteId}
        title="Automation Templates"
        description="Start from a pre-built template and customise it to fit your needs."
      />

      {/* Category filter */}
      <div className="flex flex-wrap gap-2 mb-6">
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-medium border transition-colors',
              activeCategory === cat
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border text-muted-foreground hover:text-foreground hover:border-primary/40',
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Template grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map(tpl => (
          <div
            key={tpl.id}
            className="flex flex-col rounded-lg border border-border bg-card p-5 hover:border-primary/40 hover:shadow-sm transition-all"
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Zap className="h-4 w-4 text-primary" />
              </div>
              <Badge className={cn('text-[10px] border h-5 shrink-0', tpl.categoryColor)}>
                {tpl.category}
              </Badge>
            </div>
            <h3 className="text-sm font-semibold text-foreground mb-1">{tpl.name}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed flex-1">{tpl.description}</p>
            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1">
                <Badge variant="secondary" className="text-[9px] h-4">
                  {tpl.definition.triggers[0]?.type.replace('_', ' ')}
                </Badge>
                {tpl.definition.graph.nodes
                  .filter((n): n is Extract<typeof n, { kind: 'action' }> => n.kind === 'action')
                  .slice(0, 2)
                  .map((n, i) => (
                    <Badge key={i} variant="outline" className="text-[9px] h-4">
                      {n.action.type.replace(/_/g, ' ')}
                    </Badge>
                  ))}
              </div>
              <Button
                size="sm"
                className="h-7 text-xs shrink-0"
                onClick={() => useTemplate(tpl)}
              >
                Use template
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
