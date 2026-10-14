/** Query keys and read hooks for the AI assistant. */
import { queryOptions, useQuery } from '@tanstack/react-query';
import { aiApi } from './api';

// 'demo' is valid: the API layer answers it from fixtures (lib/demo/ai) without a request.
const isValidId = (id: string) => !!id;

export const aiKeys = {
  all: ['ai'] as const,
  conversations: () => [...aiKeys.all, 'conversation'] as const,
  status: () => [...aiKeys.all, 'status'] as const,
  list: (websiteId: string) => [...aiKeys.all, 'conversations', websiteId] as const,
  conversation: (websiteId: string, conversationId: string) =>
    [...aiKeys.conversations(), websiteId, conversationId] as const,
};

export const conversationQueryOptions = (websiteId: string, conversationId: string) =>
  queryOptions({
    queryKey: aiKeys.conversation(websiteId, conversationId),
    queryFn: () => aiApi.conversation(websiteId, conversationId),
    enabled: isValidId(websiteId) && !!conversationId,
    // A conversation only changes when this user sends a message or creates a proposal,
    // and those mutations mark it stale. Nothing else can move it, so nothing needs polling.
    staleTime: Infinity,
  });

export function useConversation(websiteId: string, conversationId: string | null) {
  return useQuery(conversationQueryOptions(websiteId, conversationId ?? ''));
}

export function useConversationList(websiteId: string) {
  return useQuery({
    queryKey: aiKeys.list(websiteId),
    queryFn: () => aiApi.conversations(websiteId),
    enabled: isValidId(websiteId),
    // Threads only change when this user sends a message; the chat invalidates on send.
    staleTime: Infinity,
  });
}

/**
 * Whether AI is configured on this deployment. Account-wide, not per website, and it
 * changes only when an operator sets a key — so it is asked once and kept.
 */
export function useAiStatus(enabled = true, websiteId?: string) {
  const demo = websiteId === 'demo';
  return useQuery({
    // The demo shows every AI feature: it is answered from fixtures, whatever this deployment has.
    queryKey: demo ? [...aiKeys.status(), 'demo'] : aiKeys.status(),
    queryFn: () => (demo ? Promise.resolve({ configured: true }) : aiApi.status()),
    enabled,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}
