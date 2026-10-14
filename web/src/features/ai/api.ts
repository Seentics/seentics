/** Endpoint functions for the AI assistant. No React, no hooks. */
import api from '@/lib/api';
import type { AskResponse, ConversationSummary, ConversationTurn } from './types';

export const aiApi = {
  async ask(
    websiteId: string, prompt: string, conversationId?: string, signal?: AbortSignal,
    recommendationId?: string,
  ): Promise<AskResponse> {
    const res = await api.post(`/ai/chat/${websiteId}`, {
      prompt,
      conversation_id: conversationId,
      // The recommendation this chat was opened from: confirming its draft marks it applied.
      ...(recommendationId ? { recommendation_id: recommendationId } : {}),
    }, { signal });
    return res.data as AskResponse;
  },

  /**
   * Create what an approved draft describes.
   *
   * Only the ids are sent. The payload is read from the stored row on the server —
   * a round-trip through the browser is a chance to change what was approved.
   */
  async confirm(websiteId: string, queryId: string): Promise<{ resource: string; id: string }> {
    const res = await api.post(`/ai/confirm/${websiteId}/${queryId}`, {});
    return res.data.created as { resource: string; id: string };
  },

  /**
   * Whether this deployment has a model configured. Anything other than a clear yes —
   * an error, a 404 from a gateway that predates the endpoint — reads as no, because
   * every caller uses it to decide whether to *offer* AI, and offering a dead feature is
   * the worse mistake.
   */
  async status(): Promise<{ configured: boolean }> {
    try {
      const res = await api.get('/ai/status');
      return { configured: res.data?.data?.configured === true };
    } catch {
      return { configured: false };
    }
  },

  async conversations(websiteId: string): Promise<ConversationSummary[]> {
    const res = await api.get(`/ai/conversations/${websiteId}`);
    return (res.data?.conversations ?? []) as ConversationSummary[];
  },

  async conversation(websiteId: string, conversationId: string): Promise<ConversationTurn[]> {
    const res = await api.get(`/ai/conversation/${websiteId}/${conversationId}`);
    return (res.data?.turns ?? []) as ConversationTurn[];
  },
};
