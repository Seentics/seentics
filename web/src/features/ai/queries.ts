/** Query keys and read hooks for the AI assistant. */
import { queryOptions, useQuery } from '@tanstack/react-query';
import { aiApi } from './api';

const isValidId = (id: string) => !!id && id !== 'demo';

export const aiKeys = {
  all: ['ai'] as const,
  conversations: () => [...aiKeys.all, 'conversation'] as const,
  list: (websiteId: string) => [...aiKeys.all, 'conversations', websiteId] as const,
  conversation: (websiteId: string, conversationId: string) =>
    [...aiKeys.conversations(), websiteId, conversationId] as const,
};

export const conversationQueryOptions = (websiteId: string, conversationId: string) =>
  queryOptions({
    queryKey: aiKeys.conversation(websiteId, conversationId),
    queryFn: () => aiApi.conversation(websiteId, conversationId),
    enabled: isValidId(websiteId) && !!conversationId,
    // A conversation only changes when this user sends a message, and the mutation
    // updates the cache directly. Nothing else can move it, so nothing needs polling.
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
