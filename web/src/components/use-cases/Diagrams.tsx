import { ArrowRight, Bell, CircleDot, MousePointerClick, Send, Target } from 'lucide-react';
import type { ReactNode } from 'react';

/**
 * Diagrams drawn in the page's own tokens, so they follow the theme. The numbers in
 * FunnelViz are sample data and say so on the figure: they illustrate the shape of a
 * report, they are not a measurement.
 */

function Node({
  tone, label, value, icon,
}: { tone: 'trigger' | 'condition' | 'action' | 'result'; label: string; value: string; icon: ReactNode }) {
  const tones = {
    trigger: 'border-sky-500/30 bg-sky-500/[0.07] text-sky-600 dark:text-sky-400',
    condition: 'border-amber-500/30 bg-amber-500/[0.07] text-amber-600 dark:text-amber-400',
    action: 'border-violet-500/30 bg-violet-500/[0.07] text-violet-600 dark:text-violet-400',
    result: 'border-emerald-500/30 bg-emerald-500/[0.07] text-emerald-600 dark:text-emerald-400',
  } as const;
  return (
    <div className={`flex min-w-0 flex-1 flex-col rounded-xl border p-4 ${tones[tone]}`}>
      <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider">{icon}{label}</span>
      <span className="mt-2 text-[14px] font-semibold leading-snug text-foreground">{value}</span>
    </div>
  );
}

/** When → (only if) → then → what you see: one automation, as the builder shows it. */
export function FlowDiagram({
  trigger, condition, action, result,
}: { trigger: string; condition?: string; action: string; result: string }) {
  const arrow = <ArrowRight className="mx-1 hidden h-5 w-5 shrink-0 self-center text-muted-foreground/60 md:block" aria-hidden />;
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-stretch md:gap-0">
      <Node tone="trigger" label="When" value={trigger} icon={<MousePointerClick className="h-3.5 w-3.5" />} />
      {condition && (<>{arrow}<Node tone="condition" label="Only if" value={condition} icon={<CircleDot className="h-3.5 w-3.5" />} /></>)}
      {arrow}
      <Node tone="action" label="Then" value={action} icon={<Send className="h-3.5 w-3.5" />} />
      {arrow}
      <Node tone="result" label="You see" value={result} icon={<Target className="h-3.5 w-3.5" />} />
    </div>
  );
}

/** A funnel as stepped bars, with the biggest drop marked. Sample data. */
export function FunnelViz({
  steps, caption,
}: { steps: { label: string; value: number }[]; caption?: string }) {
  const top = steps[0]?.value || 1;
  let worst = 0, worstDrop = -1;
  steps.forEach((s, i) => {
    if (i === 0) return;
    const drop = steps[i - 1]!.value - s.value;
    if (drop > worstDrop) { worstDrop = drop; worst = i; }
  });
  return (
    <figure className="rounded-xl border border-border bg-card p-5 sm:p-6">
      <div className="space-y-3">
        {steps.map((s, i) => {
          const prev = steps[i - 1]?.value;
          const kept = prev ? Math.round((s.value / prev) * 100) : null;
          return (
            <div key={s.label}>
              <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
                <span className="font-medium text-foreground">{i + 1}. {s.label}</span>
                <span className="tabular-nums text-muted-foreground">{s.value.toLocaleString('en-US')}</span>
              </div>
              <div className="h-7 overflow-hidden rounded-md bg-muted/60">
                <div
                  className={`h-full rounded-md ${i === worst ? 'bg-amber-500/80' : 'bg-primary/80'}`}
                  style={{ width: `${Math.max(3, (s.value / top) * 100)}%` }}
                />
              </div>
              {kept !== null && (
                <p className={`mt-1 text-[12px] ${i === worst ? 'font-semibold text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
                  {kept}% continued{i === worst ? ' · biggest drop, start here' : ''}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <figcaption className="mt-4 text-[12px] text-muted-foreground">{caption ?? 'Sample data, to show the shape of the report.'}</figcaption>
    </figure>
  );
}

/** The loop every page is an instance of: see it, understand it, act on it, check it. */
export function LoopDiagram({ steps }: { steps: { title: string; body: string }[] }) {
  return (
    <ol className="grid gap-3 md:grid-cols-4">
      {steps.map((s, i) => (
        <li key={s.title} className="relative rounded-xl border border-border bg-card p-4">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-[13px] font-bold text-primary">{i + 1}</span>
          <h3 className="mt-3 text-[14.5px] font-semibold text-foreground">{s.title}</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">{s.body}</p>
          {i < steps.length - 1 && <ArrowRight className="absolute -right-3 top-1/2 z-10 hidden h-5 w-5 -translate-y-1/2 rounded-full bg-background text-muted-foreground/60 md:block" aria-hidden />}
        </li>
      ))}
    </ol>
  );
}

/** A message landing in the team's channel, from a Webhook action. Illustrative. */
export function AlertMock({ title, lines, channel = '#sales' }: { title: string; lines: string[]; channel?: string }) {
  return (
    <figure className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Bell className="h-4 w-4" /></span>
        <div className="min-w-0">
          <p className="text-[12px] text-muted-foreground">{channel} · from your Seentics webhook</p>
          <p className="mt-0.5 text-[14.5px] font-semibold text-foreground">{title}</p>
          <ul className="mt-2 space-y-1">
            {lines.map((l) => <li key={l} className="text-[13px] text-muted-foreground">{l}</li>)}
          </ul>
        </div>
      </div>
      <figcaption className="mt-4 text-[12px] text-muted-foreground">Example of a webhook message. What it contains is up to the endpoint you point it at.</figcaption>
    </figure>
  );
}
