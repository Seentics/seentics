/** Write hooks for the AI assistant. */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { aiApi } from './api';
import { aiKeys } from './queries';

export function useAskAi(websiteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { prompt: string; conversationId?: string; signal?: AbortSignal; recommendationId?: string }) =>
      aiApi.ask(websiteId, vars.prompt, vars.conversationId, vars.signal, vars.recommendationId),
    /*
     * The open thread is not refetched — a reply carries display blocks the stored
     * conversation does not, so refetching would replace rendered panels with plain
     * text. It is only marked stale, so reopening it later from the sidebar loads the
     * new turns. The thread *list* is refetched, because a first message creates a new
     * thread that belongs in the sidebar.
     */
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: aiKeys.list(websiteId) });
      if (res.queryId != null) {
        void qc.invalidateQueries({
          queryKey: aiKeys.conversation(websiteId, res.conversationId),
          refetchType: 'none',
        });
      }
    },
  });
}

export function useConfirmProposal(websiteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { queryId: string; conversationId: string }) =>
      aiApi.confirm(websiteId, vars.queryId),
    onSuccess: (_created, vars) => {
      // The created or changed resource is new; anything listing it is stale.
      void qc.invalidateQueries({ queryKey: ['automations', websiteId] });
      void qc.invalidateQueries({ queryKey: ['automation', websiteId] });
      void qc.invalidateQueries({ queryKey: ['website', websiteId] });
      void qc.invalidateQueries({ queryKey: ['errors'] });
      void qc.invalidateQueries({ queryKey: [...aiKeys.all, 'alerts', websiteId] });
      void qc.invalidateQueries({ queryKey: [...aiKeys.all, 'alert-settings', websiteId] });
      void qc.invalidateQueries({ queryKey: ['goals', websiteId] });
      void qc.invalidateQueries({ queryKey: ['analytics', 'funnels', websiteId] });
      void qc.invalidateQueries({ queryKey: ['analytics', 'funnel', websiteId] });
      // A confirmed draft marks its recommendation applied, or records a new one being measured.
      void qc.invalidateQueries({ queryKey: [...aiKeys.all, 'recommendations', websiteId] });
      // Stored turns carry `proposalAppliedAt`. Marked stale rather than refetched, for
      // the same reason the ask does not refetch the open thread.
      void qc.invalidateQueries({
        queryKey: aiKeys.conversation(websiteId, vars.conversationId),
        refetchType: 'none',
      });
    },
  });
}
