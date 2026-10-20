'use client';

import { ArrowUpRight, Sparkles } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/features/ai/types';
import { ChatMessageView } from './ChatMessageView';

export interface ConversationViewProps {
  messages: ChatMessage[];
  /** Offered on an empty conversation. The parent decides what they say. */
  starters?: string[];
  onStarter?: (prompt: string) => void;
  emptyTitle?: string;
  emptyBody?: string;
  showUsage?: boolean;
  /** Omitted where the view is read-only — a shared transcript, or a fixture. */
  onConfirmProposal?: (messageId: string) => void;
  onDismissProposal?: (messageId: string) => void;
  /** Messages whose proposal is being created. */
  confirmingIds?: ReadonlySet<string>;
  /** The viewer's role on the site, so a draft they cannot confirm says why. */
  viewerRole?: string;
  /** A stored thread is still loading; shown instead of the empty state and starters. */
  isLoading?: boolean;
  className?: string;
}

/**
 * The message list and its empty state.
 *
 * Presentational: it takes messages and callbacks and fetches nothing, so the same view
 * renders a live conversation, a stored transcript, or fixtures. Scrolling to the newest
 * message belongs to whoever owns the list, not here — a read-only transcript should
 * open at the top.
 */
export function ConversationView({
  messages, starters = [], onStarter, emptyTitle,
  emptyBody, showUsage, onConfirmProposal, onDismissProposal, confirmingIds,
  viewerRole, isLoading, className,
}: ConversationViewProps) {
  const t = useT().ai.chat;
  if (messages.length === 0 && isLoading) {
    return (
      <div className={cn('space-y-4 py-2', className)} aria-busy="true">
        {[0, 1].map((i) => (
          <div key={i} className="space-y-3">
            <div className="ml-auto h-9 w-1/2 animate-pulse rounded-xl bg-muted/60" />
            <div className="h-16 w-3/4 animate-pulse rounded-xl bg-muted/40" />
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className={cn('mx-auto max-w-lg pb-6 pt-[12vh]', className)}>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-primary">
          <Sparkles className="h-4 w-4" />
        </span>
        <p className="mt-4 text-lg font-semibold tracking-tight text-foreground">{emptyTitle ?? t.emptyTitle}</p>
        {emptyBody && <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{emptyBody}</p>}
        {!!starters.length && onStarter && (
          <ul className="mt-6 divide-y divide-border overflow-hidden rounded-xl border border-border">
            {starters.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => onStarter(s)}
                  className="group flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-muted/50"
                >
                  {s}
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {messages.map((m) => (
        <ChatMessageView
          key={m.id}
          message={m}
          showUsage={showUsage}
          viewerRole={viewerRole}
          isConfirming={confirmingIds?.has(m.id) ?? false}
          onConfirmProposal={
            m.proposal && onConfirmProposal ? () => onConfirmProposal(m.id) : undefined
          }
          onDismissProposal={
            m.proposal && onDismissProposal ? () => onDismissProposal(m.id) : undefined
          }
        />
      ))}
    </div>
  );
}
