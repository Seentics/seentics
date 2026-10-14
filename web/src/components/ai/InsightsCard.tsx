'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, ChevronDown, Loader2, RefreshCw, Sparkles, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { buildAskAiHref } from '@/features/ai/ask-link';
import { useAiStatus } from '@/features/ai/queries';
import { useDailyInsight, useRefreshInsight } from '@/features/ai/insights/queries';
import { ImpactHighlight } from './ImpactHighlight';
import {
  dismiss, evidenceHref, isCollapsed, isDismissed, localDay, setCollapsed,
} from '@/features/ai/insights/card-state';
import type { DailyInsight, InsightLine } from '@/features/ai/insights/types';
import { usePermissions } from '@/hooks/use-permissions';
import { cn } from '@/lib/utils';

export interface InsightsCardProps {
  websiteId: string;
  className?: string;
}

/**
 * Today's read of the website, at the top of the overview.
 *
 * Findings and suggested actions are kept apart: a finding is something to know, an
 * action is something to do, and mixing them in one list made the actions read as more
 * observations. Each action opens the assistant with its question typed in.
 *
 * Callers leave it out on embeds and the demo. It hides itself when AI is not configured
 * and there is nothing to show, and when the visitor has dismissed today's insight.
 */
export function InsightsCard({ websiteId, className }: InsightsCardProps) {
  const insight = useDailyInsight(websiteId);
  const status = useAiStatus(true, websiteId);
  const { isViewer } = usePermissions(websiteId);
  const refresh = useRefreshInsight(websiteId);

  // View state lives in localStorage, read after mount so the server markup matches.
  const [mounted, setMounted] = useState(false);
  const [dismissedDay, setDismissedDay] = useState<string | null>(null);
  const [collapsed, setCollapsedState] = useState(false);
  useEffect(() => {
    setMounted(true);
    setCollapsedState(isCollapsed(websiteId));
  }, [websiteId]);

  const day = insight.data?.date ?? localDay();
  useEffect(() => {
    if (websiteId) setDismissedDay(isDismissed(websiteId, day) ? day : null);
  }, [websiteId, day]);

  // Refresh state: a cooldown from the server, a role that cannot refresh, or a failure.
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  useEffect(() => {
    if (!cooldownUntil) return;
    const t = setTimeout(() => setCooldownUntil(null), Math.max(0, cooldownUntil - Date.now()));
    return () => clearTimeout(t);
  }, [cooldownUntil]);

  const onRefresh = async () => {
    setRefreshError(null);
    try {
      const outcome = await refresh.mutateAsync();
      if (outcome.kind === 'forbidden') setForbidden(true);
      else if (outcome.kind === 'cooldown') setCooldownUntil(Date.now() + outcome.retryAfterSec * 1000);
    } catch {
      setRefreshError('Could not generate insights right now. Try again later.');
    }
  };

  if (!mounted || !websiteId || insight.isError) return null;
  if (dismissedDay === day) return null;

  // Nothing yet: only worth a card if refreshing could produce something.
  const data = insight.data;
  if (!insight.isPending && data == null && (status.isPending || !status.data?.configured)) return null;

  const canRefresh = !isViewer && !forbidden;
  const coolingDown = cooldownUntil != null;
  const counts = data?.status === 'ready' ? countLines(data.lines) : null;

  const toggleCollapsed = () => {
    setCollapsed(websiteId, !collapsed);
    setCollapsedState(!collapsed);
  };

  return (
    <Card className={cn('surface overflow-hidden', className)}>
      <div className={cn('flex items-center gap-2 px-4 py-3', !collapsed && 'border-b border-border')}>
        <Sparkles className="h-4 w-4 shrink-0 text-primary" />
        <h2 className="text-sm font-semibold tracking-tight text-foreground">Today&apos;s insights</h2>
        {data?.date && (
          <span className="text-xs text-muted-foreground">{formatDay(data.date)}</span>
        )}
        {data?.source === 'rules' && (
          <span
            className="hidden text-[11px] text-muted-foreground/80 sm:inline"
            title="The AI model was unavailable, so these were worked out from fixed rules."
          >
            · rule-based
          </span>
        )}
        {collapsed && counts && (
          <span className="truncate text-xs text-muted-foreground">
            · {plural(counts.findings, 'finding')}{counts.actions > 0 && `, ${plural(counts.actions, 'suggestion')}`}
          </span>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-0.5">
          {canRefresh && (
            <HeaderButton
              label={cooldownUntil != null
                ? `Refresh available ${formatWait(cooldownUntil - Date.now())}`
                : 'Generate a fresh read'}
              onClick={() => void onRefresh()}
              disabled={refresh.isPending || coolingDown || insight.isPending}
            >
              {refresh.isPending
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <RefreshCw className="h-3.5 w-3.5" />}
            </HeaderButton>
          )}
          <HeaderButton
            label={collapsed ? 'Expand' : 'Collapse'}
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
          >
            <ChevronDown className={cn('h-4 w-4 transition-transform', collapsed && '-rotate-90')} />
          </HeaderButton>
          <HeaderButton
            label="Hide until tomorrow"
            onClick={() => { dismiss(websiteId, day); setDismissedDay(day); }}
          >
            <X className="h-4 w-4" />
          </HeaderButton>
        </div>
      </div>

      {!collapsed && (
        <div className="px-4 py-3">
          {insight.isPending ? (
            <div className="space-y-2.5" aria-busy="true">
              <Skeleton className="h-4 w-11/12" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          ) : data == null ? (
            <p className="text-[13px] text-muted-foreground">
              No read for today yet. Seentics looks over your traffic once a day and writes up
              what changed{canRefresh ? ' — or refresh to generate one now.' : '.'}
            </p>
          ) : data.status === 'insufficient_data' ? (
            <Notice title="Not enough data yet">
              {data.reason ?? 'There is not enough recent traffic to say anything useful. Check back once more visits come in.'}
            </Notice>
          ) : data.status === 'failed' ? (
            <Notice title="Today's insights could not be generated">
              {data.reason ?? 'Something went wrong while writing them up.'}
            </Notice>
          ) : (
            <>
              <ImpactHighlight websiteId={websiteId} className="mb-3" />
              <InsightLines websiteId={websiteId} insight={data} />
            </>
          )}

          {(refreshError || forbidden) && (
            <p className="mt-2 text-xs text-destructive">
              {forbidden ? 'Your role on this website cannot refresh insights.' : refreshError}
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

function InsightLines({ websiteId, insight }: { websiteId: string; insight: DailyInsight }) {
  const findings = insight.lines.filter((l) => l.kind === 'finding');
  const actions = insight.lines.filter((l) => l.kind === 'action');

  if (insight.lines.length === 0) {
    return <p className="text-[13px] text-muted-foreground">Nothing stood out today.</p>;
  }

  return (
    <div className="space-y-3">
      {findings.length > 0 && (
        <ul className="space-y-2">
          {findings.map((line, i) => (
            <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-foreground">
              <span className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
              <span className="min-w-0">
                {line.text}
                <Evidence websiteId={websiteId} line={line} />
              </span>
            </li>
          ))}
        </ul>
      )}

      {actions.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Suggested</p>
          <ul className="space-y-1.5">
            {actions.map((line, i) => (
              <li
                key={i}
                className="flex flex-col gap-1.5 rounded-lg bg-primary/5 px-3 py-2 text-[13px] leading-relaxed text-foreground sm:flex-row sm:items-start sm:justify-between sm:gap-3"
              >
                <span className="flex min-w-0 gap-2">
                  <ArrowRight className="mt-[0.3em] h-3.5 w-3.5 shrink-0 text-primary" />
                  <span className="min-w-0">
                    {line.text}
                    <Evidence websiteId={websiteId} line={line} />
                  </span>
                </span>
                {line.action?.prompt && (
                  <Link
                    href={buildAskAiHref(websiteId, line.action.prompt, line.action.title || 'Daily insight')}
                    title={line.action.title || 'Ask AI about this'}
                    className="ml-5 inline-flex shrink-0 items-center gap-1 self-start rounded-md px-1.5 py-0.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/10 sm:ml-0"
                  >
                    <Sparkles className="h-3 w-3" />
                    Ask AI
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** The page a line's claim comes from, as a small link — or plain text for the overview itself. */
function Evidence({ websiteId, line }: { websiteId: string; line: InsightLine }) {
  const label = line.evidence?.label?.trim();
  if (!label) return null;
  const href = evidenceHref(websiteId, line.evidence.path);
  const cls = 'ml-1.5 inline-flex items-center rounded-md border border-border px-1.5 py-px align-middle text-[11px] leading-4 text-muted-foreground';
  return href ? (
    <Link href={href} className={cn(cls, 'transition-colors hover:border-primary/40 hover:text-primary')}>
      {label}
    </Link>
  ) : (
    <span className={cls}>{label}</span>
  );
}

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="text-[13px]">
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-0.5 text-muted-foreground">{children}</p>
    </div>
  );
}

function HeaderButton({
  label, children, className, ...props
}: { label: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors',
        'hover:bg-muted/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-40',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

function countLines(lines: InsightLine[]) {
  const actions = lines.filter((l) => l.kind === 'action').length;
  return { findings: lines.length - actions, actions };
}

function plural(n: number, word: string) {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/** `2026-10-14` as "Oct 14", read in the visitor's calendar rather than shifted through UTC. */
function formatDay(date: string) {
  const d = new Date(`${date}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? date
    : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatWait(ms: number) {
  const min = Math.ceil(Math.max(0, ms) / 60000);
  if (min <= 1) return 'in a minute';
  if (min < 60) return `in ${min} min`;
  const h = Math.ceil(min / 60);
  return `in ${h} hour${h === 1 ? '' : 's'}`;
}
