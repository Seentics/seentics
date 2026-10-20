'use client';

import { usePathSegment } from '@/lib/path-segment';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Bot, ArrowLeft, Braces, LayoutTemplate, Save, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AutomationBuilder,
  type AutomationBuilderHandle,
  type AutomationDefinition,
} from '@/components/automations/AutomationBuilder';
import { useCreateAutomation } from '@/lib/automations-api';
import { useT } from '@/lib/i18n';

const TPL_KEY = 'snc_auto_tpl';

export default function NewAutomationPage() {
  const t = useT();
  const m = t.automations.editor;
  const params = { websiteId: usePathSegment(1) ?? '' };
  const router    = useRouter();
  const searchParams = useSearchParams();
  const websiteId = params?.websiteId as string;

  const [name, setName] = useState(m.untitled);
  const [initial, setInitial] = useState<AutomationDefinition | undefined>(undefined);

  // The header renders Save, so it tracks what the builder currently holds and whether
  // that is saveable. The builder stays uncontrolled; this is a report, not a source.
  const builderRef = useRef<AutomationBuilderHandle>(null);
  const [draft, setDraft] = useState<AutomationDefinition | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
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

  // Exposes the builder's real inner dialogs for video/content capture without
  // changing normal customer behaviour.
  useEffect(() => {
    if (websiteId !== 'demo') return;
    const contentState = searchParams.get('contentState');
    if (contentState !== 'settings' && contentState !== 'json') return;
    const timer = window.setTimeout(() => {
      if (contentState === 'settings') builderRef.current?.openSettings();
      if (contentState === 'json') builderRef.current?.openJson();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [searchParams, websiteId]);

  const handleSave = (definition: AutomationDefinition) => {
    createMutation.mutate(
      {
        websiteId,
        data: {
          name:       name.trim() || m.untitled,
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
            aria-label={m.backToList}
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
                placeholder={m.namePlaceholder}
              />
            </div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {m.draft}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => router.push(`/websites/${websiteId}/automations/templates`)}
          >
            <LayoutTemplate className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{m.browseTemplates}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => builderRef.current?.openSettings()}
            title={m.workflowSettings}
            aria-label={m.workflowSettings}
          >
            <Settings className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => builderRef.current?.openJson()}
            title={m.viewJson}
            aria-label={m.viewJson}
          >
            <Braces className="h-4 w-4" />
          </Button>

          <Button
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => draft && handleSave(draft)}
            disabled={!draft || errors.length > 0 || createMutation.isPending}
            title={errors[0] ?? m.saveAutomation}
          >
            <Save className="h-3.5 w-3.5" />
            {createMutation.isPending ? t.actions.saving : t.actions.save}
          </Button>
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <AutomationBuilder
          ref={builderRef}
          key={initial ? 'tpl' : 'empty'}
          initialDefinition={initial}
          onSave={handleSave}
          isSaving={createMutation.isPending}
          onChange={(def, errs) => { setDraft(def); setErrors(errs); }}
          className="absolute inset-0"
        />
      </div>
    </div>
  );
}
