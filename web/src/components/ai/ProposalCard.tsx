'use client';

import { AlertTriangle, Check, ExternalLink, Loader2, Lock, PauseCircle, Radio, ShieldAlert, Bell, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { ActionProposal, ProposalRisk } from '@/features/ai/types';
import {
  adminRequired, appliedNote, appliedNoteFor, confirmLabel, confirmPermission, diffRow, doneLabel,
  operationOf, pendingLabel, proposalBadge, riskCallouts,
} from '@/features/ai/proposal-format';

// Kept here as well: callers and tests import it from the card.
export { appliedNote };

export interface ProposalCardProps {
  proposal: ActionProposal;
  /** Omitted once applied, or where the view is read-only. */
  onConfirm?: () => void;
  onDismiss?: () => void;
  isConfirming?: boolean;
  /** True once this draft has been applied. */
  applied?: boolean;
  error?: string;
  /** The server refused it as out of date: the target changed after the draft was made. */
  stale?: boolean;
  /** The viewer's role on this site ('' while loading). Disables confirm, with a reason, below what the draft needs. */
  role?: string;
  className?: string;
}

const RISK_STYLE: Record<ProposalRisk['kind'], { icon: typeof AlertTriangle; tone: string }> = {
  live: { icon: Radio, tone: 'border-amber-200/70 bg-amber-50/80 text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-400' },
  external: { icon: AlertTriangle, tone: 'border-amber-200/70 bg-amber-50/80 text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-400' },
  data: { icon: ShieldAlert, tone: 'border-sky-200/70 bg-sky-50/80 text-sky-800 dark:border-sky-500/25 dark:bg-sky-500/10 dark:text-sky-300' },
  stops: { icon: PauseCircle, tone: 'border-border bg-muted/50 text-muted-foreground' },
  alerts: { icon: Bell, tone: 'border-border bg-muted/50 text-muted-foreground' },
};

/**
 * A draft awaiting approval: something to create, or a change to something that exists.
 *
 * Everything shown comes from what the server built from the *validated* draft — the summary,
 * the before/after diff and the risk callouts — not from the assistant's prose. That is what stops
 * the description someone reads from disagreeing with what would actually happen.
 *
 * The callouts are the point of the card: a change that goes live for visitors, changes what the
 * site collects, reaches outside the product, or needs an admin says so above the button.
 */
export function ProposalCard({
  proposal, onConfirm, onDismiss, isConfirming, applied, error, stale, role, className,
}: ProposalCardProps) {
  const t = useT().ai.proposal;
  const isCreate = operationOf(proposal) === 'create';
  const rows = (proposal.diff ?? []).map((c) => diffRow(c, t));
  const risks = riskCallouts(proposal, t);
  const permission = confirmPermission(role, proposal, t);
  // A change's summary lines repeat its diff; the diff is the clearer of the two when there is one.
  const lines = !isCreate && rows.length
    ? proposal.summary.lines.filter((l) => !(proposal.diff ?? []).some((d) => l.startsWith(`${d.label}:`)))
    : proposal.summary.lines;

  return (
    <div className={cn('rounded-xl border border-border bg-card p-4', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-[10px]">{proposalBadge(proposal, t)}</Badge>
        {applied ? (
          <Badge variant="secondary" className="gap-1 text-[10px]">
            <Check className="h-3 w-3" /> {doneLabel(proposal, t)}
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-[10px]">{pendingLabel(proposal, t)}</Badge>
        )}
        {adminRequired(proposal) && (
          <Badge variant="outline" className="gap-1 text-[10px]">
            <Lock className="h-3 w-3" /> {t.ownerOrAdmin}
          </Badge>
        )}
      </div>

      <p className="mt-2 font-medium text-foreground">{proposal.summary.title}</p>

      {rows.length > 0 && (
        <dl className="mt-2 space-y-2" aria-label={t.whatChanges}>
          {rows.map((row, i) => (
            <div key={i} className="text-sm">
              <dt className="text-xs font-medium text-muted-foreground">{row.label}</dt>
              {row.kind === 'scalar' ? (
                <dd className="break-words">
                  <span className="text-muted-foreground line-through decoration-muted-foreground/50">{row.before}</span>
                  <span className="mx-1.5 text-muted-foreground">→</span>
                  <span className="text-foreground">{row.after}</span>
                </dd>
              ) : (
                <dd>
                  <ul className="space-y-0.5">
                    {row.items.map((item, j) => (
                      <li
                        key={j}
                        className={cn(
                          'break-words',
                          item.change === 'added' && 'text-emerald-700 dark:text-emerald-400',
                          item.change === 'removed' && 'text-muted-foreground line-through',
                          item.change === 'kept' && 'text-muted-foreground',
                        )}
                      >
                        <span aria-hidden className="mr-1 inline-block w-3">
                          {item.change === 'added' ? '+' : item.change === 'removed' ? '−' : ''}
                        </span>
                        <span className="sr-only">{item.change === 'kept' ? '' : `${item.change === 'added' ? t.added : t.removed}: `}</span>
                        {item.text}
                      </li>
                    ))}
                  </ul>
                </dd>
              )}
            </div>
          ))}
        </dl>
      )}

      {lines.length > 0 && (
        <dl className="mt-2 space-y-1">
          {lines.map((line, i) => (
            <dd key={i} className="break-words text-sm text-muted-foreground">{line}</dd>
          ))}
        </dl>
      )}

      {!applied && risks.map((risk, i) => {
        const { icon: Icon, tone } = RISK_STYLE[risk.kind] ?? RISK_STYLE.alerts;
        return (
          <div key={i} className={cn('mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-xs', tone)}>
            <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{risk.message}</span>
          </div>
        );
      })}

      {stale && !applied && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          <RefreshCw className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error ?? t.stale}</span>
        </div>
      )}

      {error && !stale && (
        <p className="mt-3 text-xs text-destructive">{error}</p>
      )}

      {!applied && onConfirm && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            className="h-8 gap-1.5"
            disabled={isConfirming || !permission.allowed || stale}
            title={permission.reason}
            onClick={onConfirm}
          >
            {isConfirming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            {confirmLabel(proposal, t)}
          </Button>
          {onDismiss && (
            <Button size="sm" variant="ghost" className="h-8" disabled={isConfirming} onClick={onDismiss}>
              {t.notNow}
            </Button>
          )}
          {!permission.allowed && (
            <span className="text-xs text-muted-foreground">{permission.reason}</span>
          )}
        </div>
      )}

      {applied && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <ExternalLink className="h-3 w-3" />
          {appliedNoteFor(proposal, t)}
        </p>
      )}
    </div>
  );
}
