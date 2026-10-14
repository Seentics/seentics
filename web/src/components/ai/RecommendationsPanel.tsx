'use client';

import Link from 'next/link';
import { useState } from 'react';
import {
  Check, ChevronDown, Hourglass, Lightbulb, Loader2, Minus, Sparkles, TrendingDown, TrendingUp, X,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { useAiStatus } from '@/features/ai/queries';
import { useRecommendationAction, useRecommendations } from '@/features/ai/recommendations/queries';
import {
  SOURCE_LABEL, beforeAfter, doItHref, groupRecommendations, impactTone, measuringLabel,
} from '@/features/ai/recommendations/helpers';
import type { Recommendation } from '@/features/ai/recommendations/types';
import { usePermissions } from '@/hooks/use-permissions';
import { cn } from '@/lib/utils';

export interface RecommendationsPanelProps {
  websiteId: string;
  className?: string;
}

/** Open suggestions shown before "Show all". */
const OPEN_PREVIEW = 3;

/**
 * The autopilot loop on the overview: what to do next, what is being measured, and what changed.
 *
 * Open suggestions offer "Do it" (the assistant, with a specific prompt typed in, which leads to a
 * draft to approve), "I did this myself" and "Dismiss". Applied ones say when their reading is due;
 * measured ones show before and after, with the verdict the server worked out (never more confident
 * than the traffic allows).
 *
 * Callers leave it out on embeds and the demo. It hides itself when there is nothing to show. Most
 * suggestions come from rules, so it shows without a model; only "Do it" needs one.
 */
export function RecommendationsPanel({ websiteId, className }: RecommendationsPanelProps) {
  const list = useRecommendations(websiteId);
  const status = useAiStatus(true, websiteId);
  const { isViewer } = usePermissions(websiteId);
  const act = useRecommendationAction(websiteId);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!websiteId || list.isPending || list.isError || !list.data?.length) return null;
  const groups = groupRecommendations(list.data);
  if (!groups.open.length && !groups.measuring.length && !groups.measured.length) return null;

  const canAct = !isViewer;
  const aiReady = status.data?.configured === true;
  const open = showAll ? groups.open : groups.open.slice(0, OPEN_PREVIEW);

  const run = async (id: string, action: 'dismiss' | 'done') => {
    setError(null);
    try {
      await act.mutateAsync({ id, action });
    } catch {
      setError('That did not go through. Try again.');
    }
  };

  return (
    <Card className={cn('surface overflow-hidden', className)}>
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Lightbulb className="h-4 w-4 shrink-0 text-primary" />
        <h2 className="text-sm font-semibold tracking-tight text-foreground">Recommendations</h2>
        <span className="truncate text-xs text-muted-foreground">
          · {groups.open.length} to do{groups.measuring.length > 0 && `, ${groups.measuring.length} measuring`}
        </span>
      </div>

      <div className="space-y-4 px-4 py-3">
        {open.length > 0 && (
          <ul className="space-y-2">
            {open.map((rec) => (
              <OpenItem
                key={rec.id}
                websiteId={websiteId}
                rec={rec}
                canAct={canAct}
                aiReady={aiReady}
                busy={act.isPending && act.variables?.id === rec.id}
                onAction={(action) => void run(rec.id, action)}
              />
            ))}
          </ul>
        )}
        {groups.open.length > OPEN_PREVIEW && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showAll && 'rotate-180')} />
            {showAll ? 'Show fewer' : `Show all ${groups.open.length}`}
          </button>
        )}

        {groups.measuring.length > 0 && (
          <Section title="Measuring">
            {groups.measuring.map((rec) => (
              <li key={rec.id} className="flex items-start gap-2.5 text-[13px] leading-relaxed">
                <Hourglass className="mt-[0.3em] h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0">
                  <span className="text-foreground">{rec.title}</span>
                  <span className="ml-1.5 text-xs text-muted-foreground">{measuringLabel(rec.report)}</span>
                  {rec.report.checkpoints.length > 0 && (
                    <span className="block text-xs text-muted-foreground">{rec.report.headline}</span>
                  )}
                </span>
              </li>
            ))}
          </Section>
        )}

        {groups.measured.length > 0 && (
          <Section title="Results">
            {groups.measured.slice(0, 5).map((rec) => <MeasuredItem key={rec.id} rec={rec} />)}
          </Section>
        )}

        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </Card>
  );
}

function OpenItem({
  websiteId, rec, canAct, aiReady, busy, onAction,
}: {
  websiteId: string;
  rec: Recommendation;
  canAct: boolean;
  aiReady: boolean;
  busy: boolean;
  onAction: (action: 'dismiss' | 'done') => void;
}) {
  const href = aiReady && canAct ? doItHref(websiteId, rec) : null;
  return (
    <li className="rounded-lg bg-primary/5 px-3 py-2 text-[13px] leading-relaxed">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
        <div className="min-w-0">
          <p className="font-medium text-foreground">{rec.title}</p>
          {rec.rationale && <p className="text-muted-foreground">{rec.rationale}</p>}
          <p className="mt-0.5 text-[11px] text-muted-foreground/80">{SOURCE_LABEL[rec.source]}</p>
        </div>
        {canAct && (
          <div className="flex shrink-0 items-center gap-1 self-start">
            {href && (
              <Link
                href={href}
                title="Open the assistant with this typed in"
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
              >
                <Sparkles className="h-3 w-3" />
                Do it
              </Link>
            )}
            <SmallButton label="I did this myself" disabled={busy} onClick={() => onAction('done')}>
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            </SmallButton>
            <SmallButton label="Dismiss" disabled={busy} onClick={() => onAction('dismiss')}>
              <X className="h-3.5 w-3.5" />
            </SmallButton>
          </div>
        )}
      </div>
    </li>
  );
}

function MeasuredItem({ rec }: { rec: Recommendation }) {
  const r = rec.report;
  const tone = impactTone(r.verdict);
  const ba = beforeAfter(r);
  const Icon = tone === 'good' ? TrendingUp : tone === 'bad' ? TrendingDown : Minus;
  return (
    <li className="flex items-start gap-2.5 text-[13px] leading-relaxed">
      <Icon
        className={cn(
          'mt-[0.3em] h-3.5 w-3.5 shrink-0',
          tone === 'good' && 'text-emerald-600 dark:text-emerald-400',
          tone === 'bad' && 'text-destructive',
          tone === 'neutral' && 'text-muted-foreground',
        )}
      />
      <span className="min-w-0">
        <span className="text-foreground">{rec.title}</span>
        {ba && (
          <span className="ml-1.5 whitespace-nowrap text-xs tabular-nums text-muted-foreground">
            {ba.before} → {ba.after} ({ba.delta})
          </span>
        )}
        <span className="block text-xs text-muted-foreground" title={r.caveats.join(' ')}>
          {r.sentence}
        </span>
      </span>
    </li>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      <ul className="space-y-1.5">{children}</ul>
    </div>
  );
}

function SmallButton({
  label, children, ...props
}: { label: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
      {...props}
    >
      {children}
    </button>
  );
}
