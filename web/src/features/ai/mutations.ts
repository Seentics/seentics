/** Write hooks for the AI assistant. */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { aiApi } from './api';
import { aiKeys } from './queries';

export function useAskAi(websiteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { prompt: string; conversationId?: string }) =>
      aiApi.ask(websiteId, vars.prompt, vars.conversationId),
    /*
     * The message list is not invalidated — a reply carries display blocks the stored
     * conversation does not, so refetching would replace rendered panels with plain
     * text. The thread *list* is, because a first message creates a new thread that
     * belongs in the sidebar.
     */
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: aiKeys.all });
    },
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
