import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCostUsd } from '@/features/ai/format';
import type { ChatMessage } from '@/features/ai/types';
import { BlockRenderer } from './blocks/BlockRenderer';
import { ProposalCard } from './ProposalCard';

export interface ChatMessageViewProps {
  message: ChatMessage;
  /** Operators see what each answer cost. Hidden from everyone else. */
  showUsage?: boolean;
  onConfirmProposal?: () => void;
  onDismissProposal?: () => void;
  isConfirming?: boolean;
  /** The viewer's role on the site, for the proposal card's confirm button. */
  viewerRole?: string;
  className?: string;
}

/**
 * One turn in the conversation: prose, then whatever the tools said to draw.
 *
 * The blocks render beneath the text rather than inside it. The model writes the
 * sentence and the tools decide the panels, so the two are composed here rather than
 * interleaved — which is also what makes it impossible for a reply to place a panel
 * somewhere it chose.
 */
/** A tool's name as a person would say it: `get_funnel_performance` → "funnel performance". */
export function toolLabel(name: string): string {
  return name.replace(/^(get|list|read|fetch|query|search)_/, '').replace(/_/g, ' ').trim();
}

export function ChatMessageView({
  message, showUsage, onConfirmProposal, onDismissProposal, isConfirming, viewerRole, className,
}: ChatMessageViewProps) {
  const isUser = message.role === 'user';

  // The visitor's turn is a quiet bubble on the right; the answer is plain text across the
  // column — read like a document, not a chat app's speech bubbles.
  return (
    <div className={cn('flex', isUser && 'justify-end', className)}>
      <div className={cn('min-w-0 space-y-3', isUser ? 'flex max-w-[85%] flex-col items-end' : 'flex-1')}>
        {message.content && (
          <div
            className={cn(
              'max-w-full whitespace-pre-wrap break-words text-[14px] leading-relaxed text-foreground',
              isUser && 'rounded-2xl bg-muted px-3.5 py-2',
            )}
          >
            {message.content}
          </div>
        )}

        {message.pending && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
            Thinking…
          </div>
        )}

        {message.error && (
          <p className="text-sm text-destructive">{message.error}</p>
        )}

        {message.blocks?.map((block, i) => (
          <BlockRenderer key={i} block={block} className="w-full" />
        ))}

        {message.proposal && (
          <ProposalCard
            className="w-full"
            proposal={message.proposal}
            applied={message.proposalApplied}
            isConfirming={isConfirming}
            error={message.proposalError}
            stale={message.proposalStale}
            role={viewerRole}
            onConfirm={onConfirmProposal}
            onDismiss={onDismissProposal}
          />
        )}

        {!isUser && !!message.toolsUsed?.length && (
          <p className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <Search className="h-3 w-3" aria-hidden />
            Looked at {message.toolsUsed.map(toolLabel).join(', ')}
          </p>
        )}

        {/* Operator-only. Shown per message because that is the grain the cost is recorded at. */}
        {showUsage && message.usage && (
          <p className="text-[11px] tabular-nums text-muted-foreground">
            {message.usage.tokens.input.toLocaleString()} in ·{' '}
            {message.usage.tokens.output.toLocaleString()} out ·{' '}
            {formatCostUsd(message.usage.costUsd)} · {message.usage.ms}ms
          </p>
        )}
      </div>
    </div>
  );
}
