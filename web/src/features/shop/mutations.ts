/** Write hooks for the Shop, each invalidating what it changes. */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { shopApi } from './api';
import { shopKeys } from './queries';
import type { OrderStatus, PageInput, SteadfastKeys, StoreInput } from './types';

/** A shop write can move counts, lists and the open order: refresh the feature. */
function useInvalidateShop() {
  const qc = useQueryClient();
  return () => void qc.invalidateQueries({ queryKey: shopKeys.all });
}

export function useCreateStore() {
  const invalidate = useInvalidateShop();
  return useMutation({ mutationFn: (input: { name: string; slug: string }) => shopApi.createStore(input), onSuccess: invalidate });
}

export function useUpdateStore(websiteId: string) {
  const invalidate = useInvalidateShop();
  return useMutation({ mutationFn: (patch: Partial<StoreInput>) => shopApi.updateStore(websiteId, patch), onSuccess: invalidate });
}

export function useSavePage(websiteId: string) {
  const invalidate = useInvalidateShop();
  return useMutation({
    mutationFn: ({ id, input }: { id: string | null; input: PageInput }) =>
      id ? shopApi.updatePage(websiteId, id, input) : shopApi.createPage(websiteId, input),
    onSuccess: invalidate,
  });
}

export function useDeletePage(websiteId: string) {
  const invalidate = useInvalidateShop();
  return useMutation({ mutationFn: (pageId: string) => shopApi.deletePage(websiteId, pageId), onSuccess: invalidate });
}

export function useSetPublished(websiteId: string) {
  const invalidate = useInvalidateShop();
  return useMutation({
    mutationFn: ({ id, published }: { id: string; published: boolean }) => shopApi.setPublished(websiteId, id, published),
    onSuccess: invalidate,
  });
}

export function useUploadImage(websiteId: string) {
  return useMutation({ mutationFn: (file: File) => shopApi.uploadImage(websiteId, file) });
}

export function useUpdateOrder(websiteId: string) {
  const invalidate = useInvalidateShop();
  return useMutation({
    mutationFn: ({ id, status, note }: { id: string; status?: OrderStatus; note?: string }) => shopApi.updateOrder(websiteId, id, { status, note }),
    onSuccess: invalidate,
  });
}

export function useRecheckOrder(websiteId: string) {
  const invalidate = useInvalidateShop();
  return useMutation({ mutationFn: (id: string) => shopApi.recheck(websiteId, id), onSuccess: invalidate });
}

export function useAddToBlacklist(websiteId: string) {
  const invalidate = useInvalidateShop();
  return useMutation({ mutationFn: (entry: { phone: string; reason?: string }) => shopApi.addToBlacklist(websiteId, entry), onSuccess: invalidate });
}

export function useRemoveFromBlacklist(websiteId: string) {
  const invalidate = useInvalidateShop();
  return useMutation({ mutationFn: (id: string) => shopApi.removeFromBlacklist(websiteId, id), onSuccess: invalidate });
}

export function useSetSteadfast(websiteId: string) {
  const invalidate = useInvalidateShop();
  return useMutation({ mutationFn: (keys: SteadfastKeys | null) => shopApi.setSteadfast(websiteId, keys), onSuccess: invalidate });
}
