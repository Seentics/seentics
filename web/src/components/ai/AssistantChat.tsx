'use client';

import { useEffect, useRef } from 'react';
import { Bot, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAssistantChat } from '@/features/ai/use-assistant-chat';
import { formatCostUsd } from '@/features/ai/format';
import { ChatComposer } from './ChatComposer';
import { ConversationView } from './ConversationView';

/** Offered on an empty conversation. Each is a question the tools can actually answer. */
const STARTERS = [
  'How is traffic doing this week?',
  'Which pages have the worst bounce rate?',
  'What errors are my visitors hitting?',
  'Create an exit-intent popup offering 10% off',
];

export interface AssistantChatProps {
  websiteId: string;
  /** Reveals per-message token cost. Operators only. */
  showUsage?: boolean;
  /** Opens an existing thread instead of starting a new one. */
  conversationId?: string;
  /** Rendered in the header — the page uses it for the default-mode toggle. */
  headerActions?: React.ReactNode;
  className?: string;
}

/**
 * The assistant, composed.
 *
 * A container: it holds no markup of its own beyond the frame. State and data live in
 * `useAssistantChat`, the message list is `ConversationView` and the input is
 * `ChatComposer` — both of which take props and fetch nothing, so either can be reused
 * for a transcript, an embed, or fixtures.
 */
export function AssistantChat({
  websiteId, showUsage, conversationId, headerActions, className,
}: AssistantChatProps) {
  const chat = useAssistantChat(websiteId, conversationId);
  const endRef = useRef<HTMLDivElement>(null);

  // Scrolling belongs to whoever owns the scroll container, which is this frame — a
  // read-only transcript rendering `ConversationView` should open at the top instead.
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [chat.messages]);

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-2">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Seentics AI</span>
        </div>
        <div className="flex items-center gap-2">
          {showUsage && chat.sessionCostUsd > 0 && (
            <span className="text-[11px] tabular-nums text-muted-foreground">
              session {formatCostUsd(chat.sessionCostUsd)}
            </span>
          )}
          {headerActions}
          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={chat.reset}>
            <Plus className="h-3.5 w-3.5" /> New chat
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <ConversationView
          messages={chat.messages}
          starters={STARTERS}
          onStarter={(p) => void chat.send(p)}
          emptyBody="Traffic, funnels, recordings, heatmaps, errors and automations. I can also draft an automation for you to approve."
          showUsage={showUsage}
          confirmingId={chat.confirmingId}
          onConfirmProposal={(id) => void chat.confirmProposal(id)}
          onDismissProposal={chat.dismissProposal}
        />
        <div ref={endRef} />
      </div>

      <div className="shrink-0 border-t border-border p-3">
        <ChatComposer
          value={chat.draft}
          onChange={chat.setDraft}
          onSend={() => void chat.send(chat.draft)}
          isSending={chat.isSending}
          placeholder="Ask about traffic, funnels, errors… or ask me to set something up"
        />
      </div>
    </div>
  );
}
