'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, CornerDownLeft, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useAskAi, useConfirmProposal } from '@/features/ai/mutations';
import { useConversation } from '@/features/ai/queries';
import { formatCostUsd } from '@/features/ai/format';
import type { ChatMessage } from '@/features/ai/types';
import { ChatMessageView } from './ChatMessageView';

/** Shown on an empty conversation. Each is a question the tools can actually answer. */
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
  className?: string;
}

/**
 * The assistant.
 *
 * Messages live here rather than being refetched from the conversation endpoint after
 * each turn: a reply carries display blocks that the stored turn does not, so refetching
 * would replace rendered panels with plain text. The stored conversation is read once, to
 * restore a thread someone comes back to.
 */
export function AssistantChat({ websiteId, showUsage, className }: AssistantChatProps) {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const ask = useAskAi(websiteId);
  const confirm = useConfirmProposal(websiteId);
  const stored = useConversation(websiteId, conversationId);

  // Restore a thread that was opened rather than started. Only when the local list is
  // empty, so a live conversation is never overwritten by its own stored copy.
  useEffect(() => {
    if (!stored.data?.length || messages.length) return;
    setMessages(
      stored.data.flatMap((t): ChatMessage[] => [
        { id: `${t.id}-q`, role: 'user', content: t.prompt },
        {
          id: t.id, role: 'assistant', content: t.answer ?? '',
          proposal: t.proposal, proposalApplied: !!t.proposalAppliedAt,
        },
      ]),
    );
  }, [stored.data, messages.length]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages]);

  const send = useCallback(
    async (prompt: string) => {
      const text = prompt.trim();
      if (!text || ask.isPending) return;
      setDraft('');

      const pendingId = `pending-${Date.now()}`;
      setMessages((prev) => [
        ...prev,
        { id: `${pendingId}-q`, role: 'user', content: text },
        { id: pendingId, role: 'assistant', content: '', pending: true },
      ]);

      try {
        const res = await ask.mutateAsync({
          prompt: text,
          conversationId: conversationId ?? undefined,
        });
        setConversationId(res.conversationId);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === pendingId
              ? {
                  id: res.queryId ?? pendingId,
                  role: 'assistant',
                  content: res.answer,
                  blocks: res.blocks,
                  proposal: res.proposal,
                  toolsUsed: res.toolsUsed,
                  usage: {
                    tokens: res.tokens,
                    costUsd: res.estimatedCostUsd,
                    ms: res.executionTimeMs,
                  },
                }
              : m,
          ),
        );
      } catch (err) {
        const message =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          'Something went wrong. Try again.';
        setMessages((prev) =>
          prev.map((m) => (m.id === pendingId
            ? { ...m, pending: false, error: message }
            : m)),
        );
      }
    },
    [ask, conversationId],
  );

  const onConfirm = useCallback(
    async (messageId: string) => {
      setConfirmingId(messageId);
      try {
        await confirm.mutateAsync({ queryId: messageId });
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, proposalApplied: true } : m)));
      } catch (err) {
        const message =
          (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
          'Could not create it.';
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, error: message } : m)));
      } finally {
        setConfirmingId(null);
      }
    },
    [confirm],
  );

  const sessionCost = useMemo(
    () => messages.reduce((sum, m) => sum + (m.usage?.costUsd ?? 0), 0),
    [messages],
  );

  return (
    <div className={cn('flex h-full min-h-0 flex-col', className)}>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-2">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">Seentics AI</span>
        </div>
        <div className="flex items-center gap-2">
          {showUsage && sessionCost > 0 && (
            <span className="text-[11px] tabular-nums text-muted-foreground">
              session {formatCostUsd(sessionCost)}
            </span>
          )}
          <Button
            size="sm" variant="ghost" className="h-7 gap-1 text-xs"
            onClick={() => { setMessages([]); setConversationId(null); }}
          >
            <Plus className="h-3.5 w-3.5" /> New chat
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <div className="mx-auto max-w-md py-10 text-center">
            <Bot className="mx-auto h-8 w-8 text-muted-foreground/40" />
            <p className="mt-3 font-medium text-foreground">Ask about this website</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Traffic, funnels, recordings, heatmaps, errors and automations. I can also
              draft an automation for you to approve.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => void send(s)}
                  className="rounded-lg border border-border bg-card px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-muted/50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <ChatMessageView
              key={m.id}
              message={m}
              showUsage={showUsage}
              isConfirming={confirmingId === m.id}
              onConfirmProposal={m.proposal ? () => void onConfirm(m.id) : undefined}
              onDismissProposal={
                m.proposal
                  ? () => setMessages((prev) =>
                      prev.map((x) => (x.id === m.id ? { ...x, proposal: null } : x)))
                  : undefined
              }
            />
          ))
        )}
        <div ref={endRef} />
      </div>

      <div className="shrink-0 border-t border-border p-3">
        <div className="relative">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends, shift+enter breaks the line — the convention people expect
              // from a chat box rather than a form field.
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void send(draft);
              }
            }}
            placeholder="Ask about traffic, funnels, errors… or ask me to set something up"
            rows={2}
            maxLength={2000}
            className="resize-none pr-12 text-sm"
          />
          <Button
            size="icon"
            className="absolute bottom-2 right-2 h-8 w-8"
            disabled={!draft.trim() || ask.isPending}
            onClick={() => void send(draft)}
          >
            {ask.isPending
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <CornerDownLeft className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
