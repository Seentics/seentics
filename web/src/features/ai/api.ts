/** Endpoint functions for the AI assistant. No React, no hooks. */
import api from '@/lib/api';
import type { AskResponse, ConversationTurn } from './types';

export const aiApi = {
  async ask(websiteId: string, prompt: string, conversationId?: string): Promise<AskResponse> {
    const res = await api.post(`/ai/chat/${websiteId}`, {
      prompt,
      conversation_id: conversationId,
    });
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

  async conversation(websiteId: string, conversationId: string): Promise<ConversationTurn[]> {
    const res = await api.get(`/ai/conversation/${websiteId}/${conversationId}`);
    return (res.data?.turns ?? []) as ConversationTurn[];
  },
};
