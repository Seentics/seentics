'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle2, Circle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { SETUP_STEPS } from '@/features/agency/constants';
import type { Setup } from '@/features/agency/types';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Panel } from './ui';

/** The first-run guide: five steps from `/agency/setup`, each a link to where it is done. */
export function SetupGuide({ setup }: { setup: Setup | undefined }) {
  const t = useT().agency.setup;
  const done = new Set(setup?.steps.filter(s => s.done).map(s => s.id));
  const total = setup?.total ?? SETUP_STEPS.length;
  const completed = setup?.completed ?? done.size;
  const next = SETUP_STEPS.find(s => !done.has(s.id) && !t.steps[s.id].later);

  return (
    <Panel
      data-testid="setup-guide"
      title={t.title}
      description={t.description}
      actions={<span className="text-xs font-medium tabular-nums text-muted-foreground">{t.progress(completed, total)}</span>}
      bodyClassName="p-0"
    >
      <div className="px-4 pt-3">
        <Progress value={total ? (completed / total) * 100 : 0} className="h-1.5" aria-label={t.progressLabel} />
      </div>
      <ol className="divide-y divide-border">
        {SETUP_STEPS.map((step, i) => {
          const isDone = done.has(step.id);
          const isNext = next?.id === step.id;
          const words = t.steps[step.id];
          return (
            <li key={step.id} data-testid={`setup-step-${step.id}`} data-done={isDone} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-start gap-3">
                {isDone ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" aria-label={t.done} />
                ) : (
                  <Circle className={cn('mt-0.5 h-5 w-5 shrink-0', isNext ? 'text-primary' : 'text-muted-foreground/50')} aria-label={t.notDone} />
                )}
                <div className="min-w-0">
                  <p className={cn('text-sm font-semibold', isDone ? 'text-muted-foreground line-through decoration-muted-foreground/40' : 'text-foreground')}>
                    {i + 1}. {words.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{words.description}</p>
                  {words.later && !isDone && <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-400">{words.later}</p>}
                </div>
              </div>
              {!isDone && (
                <Button asChild size="sm" variant={isNext ? 'default' : 'outline'} className="h-8 shrink-0 gap-1.5 self-start text-xs sm:self-center">
                  <Link href={step.href}>
                    {words.cta}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              )}
            </li>
          );
        })}
      </ol>
    </Panel>
  );
}
