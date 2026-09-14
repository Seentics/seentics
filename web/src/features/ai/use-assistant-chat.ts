'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAskAi, useConfirmProposal } from './mutations';
import { useConversation } from './queries';
import type { ChatMessage } from './types';

/**
 * The assistant's state and data access, as a hook.
 *
 * Separated from the views so the views take props and nothing else — the same
 * `ConversationView` renders a live thread, a stored transcript or fixtures, and this
 * hook is the only thing that knows an API exists.
 */
export function useAssistantChat(websiteId: string, initialConversationId?: string) {
  const [conversationId, setConversationId] = useState<string | null>(
    initialConversationId ?? null,
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const ask = useAskAi(websiteId);
  const confirm = useConfirmProposal(websiteId);
  const stored = useConversation(websiteId, conversationId);

  /*
   * Restore a thread that was opened rather than started, and only while the local list
   * is empty — otherwise a live conversation would be overwritten by its own stored copy,
   * which carries no display blocks and would replace rendered panels with plain text.
   */
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
        setMessages((prev) =>
          prev.map((m) => (m.id === pendingId
            ? { ...m, pending: false, error: errorMessage(err, 'Something went wrong. Try again.') }
            : m)),
        );
      }
    },
    [ask, conversationId],
  );

  const confirmProposal = useCallback(
    async (messageId: string) => {
      setConfirmingId(messageId);
      try {
        await confirm.mutateAsync({ queryId: messageId });
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, proposalApplied: true } : m)));
      } catch (err) {
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId
            ? { ...m, error: errorMessage(err, 'Could not create it.') }
            : m)));
      } finally {
        setConfirmingId(null);
      }
    },
    [confirm],
  );

  const dismissProposal = useCallback((messageId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, proposal: null } : m)));
  }, []);

  const reset = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setDraft('');
  }, []);

  /** What this conversation has cost so far. Operator-facing. */
  const sessionCostUsd = useMemo(
    () => messages.reduce((sum, m) => sum + (m.usage?.costUsd ?? 0), 0),
    [messages],
  );

  return {
    conversationId, messages, draft, setDraft,
    send, confirmProposal, dismissProposal, reset,
    isSending: ask.isPending, confirmingId, sessionCostUsd,
  };
}

/** The server's own message when there is one; a readable fallback when there is not. */
function errorMessage(err: unknown, fallback: string): string {
  return (
    (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback
  );
}
