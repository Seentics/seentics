/** Write hooks for the AI assistant. */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { aiApi } from './api';
import { aiKeys } from './queries';

export function useAskAi(websiteId: string) {
  return useMutation({
    mutationFn: (vars: { prompt: string; conversationId?: string }) =>
      aiApi.ask(websiteId, vars.prompt, vars.conversationId),
    /*
     * No invalidation. The chat keeps its own message list, because a reply carries
     * display blocks the stored conversation does not — refetching would replace a
     * rendered answer with a plain one.
     */
  });
}

export function useConfirmProposal(websiteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { queryId: string }) => aiApi.confirm(websiteId, vars.queryId),
    onSuccess: () => {
      // The created resource now exists; anything listing it is stale.
      void qc.invalidateQueries({ queryKey: ['automations'] });
      void qc.invalidateQueries({ queryKey: aiKeys.conversations() });
    },
  });
}
