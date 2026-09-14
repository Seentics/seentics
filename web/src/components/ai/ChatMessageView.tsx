import { Bot, User, Wrench } from 'lucide-react';
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
export function ChatMessageView({
  message, showUsage, onConfirmProposal, onDismissProposal, isConfirming, className,
}: ChatMessageViewProps) {
  const isUser = message.role === 'user';

  return (
    <div className={cn('flex gap-3', isUser && 'flex-row-reverse', className)}>
      <div
        className={cn(
          'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg',
          isUser ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground',
        )}
      >
        {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
      </div>

      <div className={cn('min-w-0 flex-1 space-y-2', isUser && 'flex flex-col items-end')}>
        {message.content && (
          <div
            className={cn(
              'max-w-full whitespace-pre-wrap break-words rounded-xl px-3 py-2 text-sm',
              isUser
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted/50 text-foreground',
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
            onConfirm={onConfirmProposal}
            onDismiss={onDismissProposal}
          />
        )}

        {!isUser && !!message.toolsUsed?.length && (
          <p className="flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
            <Wrench className="h-3 w-3" />
            {message.toolsUsed.join(', ')}
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
