'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
export function useAssistantChat(
  websiteId: string, initialConversationId?: string, initialDraft?: string,
  initialRecommendationId?: string | null,
) {
  const [conversationId, setConversationId] = useState<string | null>(
    initialConversationId ?? null,
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  // A prefill from "Ask AI about this" — typed in, never sent on its own.
  const [draft, setDraft] = useState(initialDraft ?? '');
  // Opened from a recommendation's "Do it": every turn of this chat carries its id, since the
  // draft it leads to may come a turn or two after the first question. Cleared by "New".
  const [recommendationId, setRecommendationId] = useState<string | null>(initialRecommendationId ?? null);
  const [confirmingIds, setConfirmingIds] = useState<ReadonlySet<string>>(() => new Set());

  const ask = useAskAi(websiteId);
  const confirm = useConfirmProposal(websiteId);
  const stored = useConversation(websiteId, conversationId);

  /*
   * Bumped by `reset`. A reply that lands after "New" belongs to a thread that is no
   * longer on screen, so anything started under an older generation is dropped rather
   * than written into the fresh one.
   */
  const generation = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  /** Synchronous twin of `confirmingIds`, so a double click cannot send twice. */
  const confirmingRef = useRef(new Set<string>());

  useEffect(() => () => abortRef.current?.abort(), []);

  /*
   * A stored thread is being fetched and nothing is on screen yet. The view shows a
   * loading state instead of starters, and sending waits — a message typed now would
   * fill the list and the restore below would never run.
   */
  const isRestoring = !!conversationId && messages.length === 0 && stored.isLoading;

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
          error: t.status === 'error' && !t.answer
            ? 'This answer could not be generated.'
            : undefined,
        },
      ]),
    );
  }, [stored.data, messages.length]);

  const send = useCallback(
    async (prompt: string) => {
      const text = prompt.trim();
      if (!text || ask.isPending || isRestoring) return;
      setDraft('');

      const gen = generation.current;
      const controller = new AbortController();
      abortRef.current = controller;

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
          signal: controller.signal,
          recommendationId: recommendationId ?? undefined,
        });
        if (gen !== generation.current) return;
        // An off-topic refusal is not stored and comes back with a throwaway id and no
        // query id. Adopting it would point the chat (and sidebar) at a thread that does
        // not exist.
        if (res.queryId != null || conversationId) setConversationId(res.conversationId);
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
        if (gen !== generation.current) return;
        setMessages((prev) =>
          prev.map((m) => (m.id === pendingId
            ? { ...m, pending: false, error: errorMessage(err, 'Something went wrong. Try again.') }
            : m)),
        );
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
      }
    },
    [ask, conversationId, isRestoring, recommendationId],
  );

  const confirmProposal = useCallback(
    async (messageId: string) => {
      const target = messages.find((m) => m.id === messageId);
      if (confirmingRef.current.has(messageId) || target?.proposalApplied) return;
      if (!conversationId) return;

      const gen = generation.current;
      const setConfirming = (on: boolean) => {
        if (on) confirmingRef.current.add(messageId);
        else confirmingRef.current.delete(messageId);
        setConfirmingIds(new Set(confirmingRef.current));
      };

      setConfirming(true);
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, proposalError: undefined } : m)));
      try {
        await confirm.mutateAsync({ queryId: messageId, conversationId });
        if (gen !== generation.current) return;
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, proposalApplied: true } : m)));
      } catch (err) {
        if (gen !== generation.current) return;
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId
            ? { ...m, proposalError: errorMessage(err, 'Could not create it.') }
            : m)));
      } finally {
        setConfirming(false);
      }
    },
    [confirm, conversationId, messages],
  );

  const dismissProposal = useCallback((messageId: string) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === messageId ? { ...m, proposal: null } : m)));
  }, []);

  const { reset: resetAsk } = ask;
  const reset = useCallback(() => {
    generation.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    resetAsk();
    setMessages([]);
    setConversationId(null);
    setDraft('');
    setRecommendationId(null);
  }, [resetAsk]);

  /** What this conversation has cost so far. Operator-facing. */
  const sessionCostUsd = useMemo(
    () => messages.reduce((sum, m) => sum + (m.usage?.costUsd ?? 0), 0),
    [messages],
  );

  return {
    conversationId, messages, draft, setDraft,
    send, confirmProposal, dismissProposal, reset,
    isSending: ask.isPending, isRestoring, confirmingIds, sessionCostUsd,
  };
}

/** The server's own message when there is one; a readable fallback when there is not. */
function errorMessage(err: unknown, fallback: string): string {
  return (
    (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? fallback
  );
}
