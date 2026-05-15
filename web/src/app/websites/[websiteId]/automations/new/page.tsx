'use client';

import { useParams, useRouter } from 'next/navigation';
import { Bot, ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { WorkflowEditor } from '@/components/automations/WorkflowBuilder';
import { Input } from '@/components/ui/input';
import { useRef, useState } from 'react';
import { useCreateAutomation } from '@/lib/automations-api';

export default function NewAutomationPage() {
  const params = useParams();
  const router = useRouter();
  const websiteId = params?.websiteId as string;

  const [name, setName] = useState('Untitled Automation');
  const saveRef = useRef<(() => Record<string, unknown>) | null>(null);
  const createMutation = useCreateAutomation();

  const handleSave = () => {
    const definition = saveRef.current?.();
    if (!definition) return;

    const trigger = definition.trigger as Record<string, unknown> | undefined;
    const actions = (definition.actions as Record<string, unknown>[] | undefined) ?? [];

    createMutation.mutate(
      {
        websiteId,
        data: {
          name: name.trim() || 'Untitled Automation',
          triggerType: String(trigger?.event ?? 'page_view'),
          triggerConfig: {
            pageUrlMatch: trigger?.pageUrlMatch,
            rateLimitSec: trigger?.rateLimitSec,
          },
          actions: actions.map((a, i) => ({
            actionType: String(a.actionType ?? 'webhook') as any,
            actionConfig: { payload: a.configPayload ?? '' },
            orderIndex: i,
          })),
        },
      },
      {
        onSuccess: () => router.push(`/websites/${websiteId}/automations`),
      },
    );
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border/60 bg-background/95 px-3 py-2 pl-2 backdrop-blur-sm md:px-4 md:py-2.5">
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
                onChange={(e) => setName(e.target.value)}
                className="h-8 min-w-0 border-none bg-transparent px-0 py-0 text-sm font-semibold shadow-none focus-visible:ring-0 md:h-9 md:text-base md:font-bold"
                placeholder="Workflow name"
              />
            </div>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Automation builder · Draft
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            size="sm"
            className="h-9 gap-2 font-semibold text-xs shadow-sm"
            onClick={handleSave}
            disabled={createMutation.isPending}
          >
            <Save className="h-3.5 w-3.5" />
            {createMutation.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </header>

      <div className="relative min-h-0 flex-1">
        <WorkflowEditor className="absolute inset-0" saveRef={saveRef} />
      </div>
    </div>
  );
}
