/**
 * Endpoint functions for the Shop: the store, its product pages and images, orders, the
 * blacklist and the Steadfast connection. No React, no hooks: just transport. The demo site
 * answers from `lib/demo/shop`.
 */
import api from '@/lib/api';
import { demoMutationGuard, isDemo } from '@/lib/demo';
import { DEMO_BLACKLIST, DEMO_PAGES, DEMO_STORE, demoOrder, demoOrderSummary, demoOrdersPage } from '@/lib/demo/shop';
import type {
  BlacklistEntry, Order, OrderFilters, OrderPage, OrderStatus, OrderSummary, PageInput, ProductPage, SteadfastKeys, Store, StoreInput,
} from './types';

const base = (websiteId: string) => `/shop/${websiteId}`;
/** Drop empty filters, so the query string carries only what narrows the list. */
const params = (filters: Record<string, string | number>) =>
  Object.fromEntries(Object.entries(filters).filter(([, v]) => v !== '' && v !== undefined));

export const shopApi = {
  /** A new store and the website behind it. */
  async createStore(input: { name: string; slug: string }): Promise<{ store: Store; websiteId: string }> {
    const res = await api.post('/shop/stores', input);
    return res.data.data as { store: Store; websiteId: string };
  },

  /** The website's store; null for a website that is not one. */
  async store(websiteId: string): Promise<Store | null> {
    if (isDemo(websiteId)) return DEMO_STORE;
    const res = await api.get(`${base(websiteId)}/store`);
    return (res.data?.data as Store | null) ?? null;
  },

  async updateStore(websiteId: string, patch: Partial<StoreInput>): Promise<Store | null> {
    if (demoMutationGuard(websiteId)) return null;
    const res = await api.put(`${base(websiteId)}/store`, patch);
    return res.data.data as Store;
  },

  async pages(websiteId: string): Promise<ProductPage[]> {
    if (isDemo(websiteId)) return DEMO_PAGES;
    const res = await api.get(`${base(websiteId)}/pages`);
    return (res.data?.data as ProductPage[] | undefined) ?? [];
  },

  async page(websiteId: string, pageId: string): Promise<ProductPage | null> {
    if (isDemo(websiteId)) return DEMO_PAGES.find((p) => p.id === pageId) ?? null;
    const res = await api.get(`${base(websiteId)}/pages/${pageId}`);
    return (res.data?.data as ProductPage | undefined) ?? null;
  },

  async createPage(websiteId: string, input: PageInput): Promise<ProductPage | null> {
    if (demoMutationGuard(websiteId)) return null;
    const res = await api.post(`${base(websiteId)}/pages`, input);
    return res.data.data as ProductPage;
  },

  async updatePage(websiteId: string, pageId: string, input: PageInput): Promise<ProductPage | null> {
    if (demoMutationGuard(websiteId)) return null;
    const res = await api.put(`${base(websiteId)}/pages/${pageId}`, input);
    return res.data.data as ProductPage;
  },

  async deletePage(websiteId: string, pageId: string): Promise<void> {
    if (demoMutationGuard(websiteId)) return;
    await api.delete(`${base(websiteId)}/pages/${pageId}`);
  },

  async setPublished(websiteId: string, pageId: string, published: boolean): Promise<ProductPage | null> {
    if (demoMutationGuard(websiteId)) return null;
    const res = await api.post(`${base(websiteId)}/pages/${pageId}/${published ? 'publish' : 'unpublish'}`);
    return res.data.data as ProductPage;
  },

  /** One product picture; the URL it is served from. */
  async uploadImage(websiteId: string, file: File): Promise<string | null> {
    if (demoMutationGuard(websiteId)) return null;
    const form = new FormData();
    form.append('file', file);
    const res = await api.post(`${base(websiteId)}/images`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
    return (res.data.data as { url: string }).url;
  },

  async orders(websiteId: string, filters: OrderFilters): Promise<OrderPage> {
    if (isDemo(websiteId)) return demoOrdersPage(filters);
    const res = await api.get(`${base(websiteId)}/orders`, { params: params(filters) });
    return (res.data?.data as OrderPage | undefined) ?? { items: [], page: filters.page, limit: filters.limit, total: 0 };
  },

  async summary(websiteId: string, days = 30): Promise<OrderSummary> {
    if (isDemo(websiteId)) return demoOrderSummary();
    const res = await api.get(`${base(websiteId)}/orders/summary`, { params: { days } });
    return res.data.data as OrderSummary;
  },

  async order(websiteId: string, orderId: string): Promise<Order | null> {
    if (isDemo(websiteId)) return demoOrder(orderId);
    const res = await api.get(`${base(websiteId)}/orders/${orderId}`);
    return (res.data?.data as Order | undefined) ?? null;
  },

  async updateOrder(websiteId: string, orderId: string, patch: { status?: OrderStatus; note?: string }): Promise<Order | null> {
    if (demoMutationGuard(websiteId)) return null;
    const res = await api.patch(`${base(websiteId)}/orders/${orderId}`, patch);
    return res.data.data as Order;
  },

  async recheck(websiteId: string, orderId: string): Promise<Order | null> {
    if (demoMutationGuard(websiteId)) return null;
    const res = await api.post(`${base(websiteId)}/orders/${orderId}/recheck`);
    return res.data.data as Order;
  },

  async blacklist(websiteId: string): Promise<BlacklistEntry[]> {
    if (isDemo(websiteId)) return DEMO_BLACKLIST;
    const res = await api.get(`${base(websiteId)}/blacklist`);
    return (res.data?.data as BlacklistEntry[] | undefined) ?? [];
  },

  async addToBlacklist(websiteId: string, entry: { phone: string; reason?: string }): Promise<void> {
    if (demoMutationGuard(websiteId)) return;
    await api.post(`${base(websiteId)}/blacklist`, entry);
  },

  async removeFromBlacklist(websiteId: string, id: string): Promise<void> {
    if (demoMutationGuard(websiteId)) return;
    await api.delete(`${base(websiteId)}/blacklist/${id}`);
  },

  /** Connect Steadfast with the seller's own keys, or disconnect (null). The keys never come back. */
  async setSteadfast(websiteId: string, keys: SteadfastKeys | null): Promise<boolean> {
    if (demoMutationGuard(websiteId)) return true;
    const res = await api.put(`${base(websiteId)}/couriers/steadfast`, keys);
    return !!(res.data?.data as { connected?: boolean } | undefined)?.connected;
  },
};

/** The gateway's or Core's own message when it sent one (a limit reached, a slug taken). */
export function apiError(error: unknown): string | null {
  const data = (error as { response?: { data?: { error?: unknown; message?: unknown } } })?.response?.data;
  if (typeof data?.error === 'string') return data.error;
  if (typeof data?.message === 'string') return data.message;
  return null;
}
