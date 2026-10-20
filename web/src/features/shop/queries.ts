/** Query keys and read hooks for the Shop: store, pages, orders, blacklist. */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { shopApi } from './api';
import type { OrderFilters } from './types';

/** Every key descends from `all`, so a write can invalidate the whole feature at once. */
export const shopKeys = {
  all: ['shop'] as const,
  store: (websiteId: string) => [...shopKeys.all, 'store', websiteId] as const,
  pages: (websiteId: string) => [...shopKeys.all, 'pages', websiteId] as const,
  page: (websiteId: string, pageId: string) => [...shopKeys.all, 'page', websiteId, pageId] as const,
  orders: (websiteId: string, filters: OrderFilters) => [...shopKeys.all, 'orders', websiteId, filters] as const,
  summary: (websiteId: string) => [...shopKeys.all, 'summary', websiteId] as const,
  order: (websiteId: string, orderId: string) => [...shopKeys.all, 'order', websiteId, orderId] as const,
  blacklist: (websiteId: string) => [...shopKeys.all, 'blacklist', websiteId] as const,
};

const STALE_MS = 30_000;

export function useStore(websiteId: string) {
  return useQuery({
    queryKey: shopKeys.store(websiteId),
    queryFn: () => shopApi.store(websiteId),
    enabled: !!websiteId,
    staleTime: STALE_MS,
    // A website that is not a store answers null; an older Core without the shop answers 404.
    retry: false,
  });
}

export function usePages(websiteId: string, enabled = true) {
  return useQuery({ queryKey: shopKeys.pages(websiteId), queryFn: () => shopApi.pages(websiteId), enabled: enabled && !!websiteId, staleTime: STALE_MS });
}

export function useOrders(websiteId: string, filters: OrderFilters, enabled = true) {
  return useQuery({
    queryKey: shopKeys.orders(websiteId, filters),
    queryFn: () => shopApi.orders(websiteId, filters),
    enabled: enabled && !!websiteId,
    staleTime: STALE_MS,
    // New orders arrive while the seller is looking.
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useOrderSummary(websiteId: string, enabled = true) {
  return useQuery({
    queryKey: shopKeys.summary(websiteId),
    queryFn: () => shopApi.summary(websiteId),
    enabled: enabled && !!websiteId,
    staleTime: STALE_MS,
    refetchInterval: 60_000,
  });
}

export function useOrder(websiteId: string, orderId: string | null) {
  return useQuery({
    queryKey: shopKeys.order(websiteId, orderId ?? ''),
    queryFn: () => shopApi.order(websiteId, orderId!),
    enabled: !!websiteId && !!orderId,
    staleTime: 10_000,
  });
}

export function useBlacklist(websiteId: string, enabled = true) {
  return useQuery({ queryKey: shopKeys.blacklist(websiteId), queryFn: () => shopApi.blacklist(websiteId), enabled: enabled && !!websiteId, staleTime: STALE_MS });
}
