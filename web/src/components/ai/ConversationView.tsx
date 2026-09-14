import { Bot } from 'lucide-react';
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
  confirmingId?: string | null;
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
  messages, starters = [], onStarter, emptyTitle = 'Ask about this website',
  emptyBody, showUsage, onConfirmProposal, onDismissProposal, confirmingId, className,
}: ConversationViewProps) {
  if (messages.length === 0) {
    return (
      <div className={cn('mx-auto max-w-md py-10 text-center', className)}>
        <Bot className="mx-auto h-8 w-8 text-muted-foreground/40" />
        <p className="mt-3 font-medium text-foreground">{emptyTitle}</p>
        {emptyBody && <p className="mt-1 text-sm text-muted-foreground">{emptyBody}</p>}
        {!!starters.length && onStarter && (
          <div className="mt-4 flex flex-col gap-2">
            {starters.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onStarter(s)}
                className="rounded-lg border border-border bg-card px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted/50"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {messages.map((m) => (
        <ChatMessageView
          key={m.id}
          message={m}
          showUsage={showUsage}
          isConfirming={confirmingId === m.id}
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
