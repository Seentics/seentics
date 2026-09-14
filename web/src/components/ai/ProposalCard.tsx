import { AlertTriangle, Check, ExternalLink, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ActionProposal } from '@/features/ai/types';

export interface ProposalCardProps {
  proposal: ActionProposal;
  /** Omitted once created, or where the view is read-only. */
  onConfirm?: () => void;
  onDismiss?: () => void;
  isConfirming?: boolean;
  /** True once this draft has been created. */
  applied?: boolean;
  error?: string;
  className?: string;
}

/**
 * A draft awaiting approval.
 *
 * Everything shown comes from `summary`, which the server built from the *validated*
 * payload — not from the assistant's prose. That is what stops the description someone
 * reads from disagreeing with what would actually be created.
 *
 * `hasExternalEffect` gets its own warning because those two actions are the only ones
 * that matter beyond this dashboard: a webhook posts to a third party, a redirect sends
 * visitors to another origin. Everything else changes a page the customer already owns.
 */
export function ProposalCard({
  proposal, onConfirm, onDismiss, isConfirming, applied, error, className,
}: ProposalCardProps) {
  return (
    <div className={cn('rounded-xl border border-border bg-card p-4', className)}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-[10px] capitalize">
          {proposal.operation} {proposal.resource}
        </Badge>
        {applied ? (
          <Badge variant="secondary" className="gap-1 text-[10px]">
            <Check className="h-3 w-3" /> Created
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-[10px]">Draft — nothing created yet</Badge>
        )}
      </div>

      <p className="mt-2 font-medium text-foreground">{proposal.summary.title}</p>

      <dl className="mt-2 space-y-1">
        {proposal.summary.lines.map((line, i) => (
          <dd key={i} className="break-words text-sm text-muted-foreground">{line}</dd>
        ))}
      </dl>

      {proposal.summary.hasExternalEffect && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200/70 bg-amber-50/80 px-3 py-2 text-xs text-amber-800 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-400">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            This reaches outside Seentics — it sends data to, or redirects visitors to, an
            address above. Check it before creating.
          </span>
        </div>
      )}

      {error && (
        <p className="mt-3 text-xs text-destructive">{error}</p>
      )}

      {!applied && onConfirm && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" className="h-8 gap-1.5" disabled={isConfirming} onClick={onConfirm}>
            {isConfirming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Create it
          </Button>
          {onDismiss && (
            <Button size="sm" variant="ghost" className="h-8" disabled={isConfirming} onClick={onDismiss}>
              Not now
            </Button>
          )}
        </div>
      )}

      {applied && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <ExternalLink className="h-3 w-3" />
          Created inactive — enable it on the Automations page when you're ready.
        </p>
      )}
    </div>
  );
}
