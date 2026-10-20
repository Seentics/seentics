'use client';

import { usePathSegment } from '@/lib/path-segment';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ReportPage } from '@/components/ui/linear-list';
import { cn } from '@/lib/utils';
import type { AutomationDefinition } from '@/components/automations/AutomationBuilder';

const TPL_KEY = 'snc_auto_tpl';

import { TEMPLATES, CATEGORIES, type Template } from '@/features/automations/templates';
import { useT } from '@/lib/i18n';
import { actionLabel, triggerLabel } from '@/features/automations/catalog';

export default function AutomationTemplatesPage() {
  const m = useT().automations;
  const params = { websiteId: usePathSegment(1) ?? '' };
  const router    = useRouter();
  const websiteId = params?.websiteId as string;

  const [activeCategory, setActiveCategory] = useState<(typeof CATEGORIES)[number]>('all');

  const filtered = activeCategory === 'all'
    ? TEMPLATES
    : TEMPLATES.filter(t => t.category === activeCategory);

  const useTemplate = (tpl: Template) => {
    try {
      localStorage.setItem(TPL_KEY, JSON.stringify({ name: m.templates[tpl.id].name, definition: tpl.definition }));
    } catch { /* private mode */ }
    router.push(`/websites/${websiteId}/automations/new`);
  };

  return (
    <ReportPage
      title={m.templatesPage.title}
      parent={{ label: m.templatesPage.parent, onClick: () => router.push(`/websites/${websiteId}/automations`) }}
      description={m.templatesPage.description}
      websiteId={websiteId}
    >
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
            {m.categories[cat]}
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
                {m.categories[tpl.category]}
              </Badge>
            </div>
            <h3 className="text-sm font-semibold text-foreground mb-1">{m.templates[tpl.id].name}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed flex-1">{m.templates[tpl.id].description}</p>
            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1">
                <Badge variant="secondary" className="text-[9px] h-4">
                  {tpl.definition.triggers[0] && triggerLabel(tpl.definition.triggers[0].type, m.catalog)}
                </Badge>
                {tpl.definition.graph.nodes
                  .filter((n): n is Extract<typeof n, { kind: 'action' }> => n.kind === 'action')
                  .slice(0, 2)
                  .map((n, i) => (
                    <Badge key={i} variant="outline" className="text-[9px] h-4">
                      {actionLabel(n.action.type, false, m.catalog)}
                    </Badge>
                  ))}
              </div>
              <Button
                size="sm"
                className="h-7 text-xs shrink-0"
                onClick={() => useTemplate(tpl)}
              >
                {m.templatesPage.useTemplate}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </ReportPage>
  );
}
