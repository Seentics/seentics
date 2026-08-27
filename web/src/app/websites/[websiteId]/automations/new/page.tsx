'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Bot, ArrowLeft, LayoutTemplate } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AutomationBuilder, type AutomationDefinition } from '@/components/automations/AutomationBuilder';
import { useCreateAutomation } from '@/lib/automations-api';

const TPL_KEY = 'snc_auto_tpl';

export default function NewAutomationPage() {
  const params    = useParams();
  const router    = useRouter();
  const websiteId = params?.websiteId as string;

  const [name, setName] = useState('Untitled Automation');
  const [initial, setInitial] = useState<AutomationDefinition | undefined>(undefined);
  const createMutation = useCreateAutomation();

  // Load template pre-fill from localStorage (set by templates page)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(TPL_KEY);
      if (raw) {
        const tpl = JSON.parse(raw) as { name?: string; definition?: AutomationDefinition };
        if (tpl.name)       setName(tpl.name);
        if (tpl.definition) setInitial(tpl.definition);
        localStorage.removeItem(TPL_KEY);
      }
    } catch { /* ignore */ }
  }, []);

  const handleSave = (definition: AutomationDefinition) => {
    createMutation.mutate(
      {
        websiteId,
        data: {
          name:       name.trim() || 'Untitled Automation',
          definition: definition as unknown as Record<string, unknown>,
        },
      },
      { onSuccess: () => router.push(`/websites/${websiteId}/automations`) },
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border bg-background/95 px-3 py-2 pl-2 backdrop-blur-sm md:px-4 md:py-2.5">
        <div className="flex min-w-0 items-center gap-2 md:gap-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-9 w-9 shrink-0 rounded-full"
            onClick={() => router.push(`/websites/${websiteId}/automations`)}
            aria-label="Back to automations"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="hidden h-6 w-px shrink-0 bg-border/50 sm:block" />
          <div className="min-w-0 flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 shrink-0 text-primary" />
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                className="h-8 min-w-0 border-none bg-transparent px-0 py-0 text-sm font-semibold shadow-none focus-visible:ring-0 md:h-9 md:text-base md:font-bold"
                placeholder="Automation name"
              />
            </div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Automation builder · Draft
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => router.push(`/websites/${websiteId}/automations/templates`)}
        >
          <LayoutTemplate className="h-3.5 w-3.5" />
          Browse templates
        </Button>
      </header>

      <div className="relative min-h-0 flex-1">
        <AutomationBuilder
          key={initial ? 'tpl' : 'empty'}
          initialDefinition={initial}
          onSave={handleSave}
          isSaving={createMutation.isPending}
          className="absolute inset-0"
        />
      </div>
    </div>
  );
}
