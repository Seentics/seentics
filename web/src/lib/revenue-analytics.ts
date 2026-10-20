import { useQuery } from '@tanstack/react-query';
import api from './api';
import { isDemo } from './demo';
import { demoRevenueDashboard as loadDemo } from './demo/revenue';
import { getUserTimezone } from '@/features/analytics/format';
import { isValidId } from './utils';

export type RevenueDataQuality = 'full' | 'partial' | 'no_revenue';

export interface RevenueSummary {
  total_revenue: number;
  currency: string;
  orders: number;
  aov: number;
  sessions: number;
  revenue_per_session: number;
  arpu: number;
  unique_customers: number;
  refund_total?: number;
  new_customer_revenue_pct?: number;
  prior_period?: { total_revenue: number; orders: number; change_pct: number };
}

export interface RevenueDailyPoint {
  date: string;
  revenue: number;
  orders: number;
}

export interface RevenueByRow {
  name: string;
  revenue: number;
  orders: number;
  share_pct: number;
}

export interface RevenueTransaction {
  id: string;
  occurred_at: string;
  value: number;
  currency: string;
  product_name?: string;
  order_id?: string;
  source?: string;
  medium?: string;
  campaign?: string;
  country?: string;
  user_type?: 'new' | 'returning';
  /**
   * The site's own line items, stored as sent — `{ sku, name, qty, price }` or GA4's
   * `{ item_id, item_name, quantity, price }`. Read them through `lineItems()`
   * (`features/revenue/format`), not directly.
   */
  items?: Array<Record<string, unknown>>;
}

/** Orders in a currency other than the dashboard's, which the totals leave out. */
export interface RevenueOtherCurrency {
  currency: string;
  orders: number;
  revenue: number;
}

export interface RevenueDashboardResponse {
  website_id: string;
  days: number;
  data_quality: RevenueDataQuality;
  summary: RevenueSummary;
  daily: RevenueDailyPoint[];
  by_source: RevenueByRow[];
  by_medium: RevenueByRow[];
  by_campaign: RevenueByRow[];
  by_product: RevenueByRow[];
  by_country: RevenueByRow[];
  recent_transactions: RevenueTransaction[];
  /** Present when some orders were in another currency: listed, not converted or totalled. */
  other_currencies?: RevenueOtherCurrency[];
  /** Present when data_quality is not 'full' */
  data_note?: string;
}

export async function getRevenueDashboard(websiteId: string, days: number = 30): Promise<RevenueDashboardResponse> {
  if (isDemo(websiteId)) {
    return loadDemo(days);
  }

  const params = new URLSearchParams({ days: String(days), timezone: getUserTimezone() });
  const res = await api.get<RevenueDashboardResponse>(`/analytics/revenue/${websiteId}?${params.toString()}`);
  return res.data;
}

/**
 * One transaction by its event id, or `null` when the site has no such purchase.
 *
 * Read on its own rather than found in the dashboard's `recent_transactions`, which holds
 * only the latest 50 — every older order used to read as "not found". A failed request
 * throws, so the page can tell "no such order" from "could not load it".
 */
export async function getRevenueTransaction(websiteId: string, transactionId: string): Promise<RevenueTransaction | null> {
  if (isDemo(websiteId)) {
    return loadDemo(90).recent_transactions.find((t) => t.id === transactionId) ?? null;
  }
  try {
    const res = await api.get<{ data: RevenueTransaction }>(`/analytics/revenue-transaction/${websiteId}`, {
      params: { id: transactionId },
    });
    return res.data?.data ?? null;
  } catch (error) {
    if ((error as { response?: { status?: number } })?.response?.status === 404) return null;
    throw error;
  }
}

export const revenueKeys = {
  all: ['revenue'] as const,
  dashboard: (websiteId: string, days: number) => [...revenueKeys.all, 'dashboard', websiteId, days] as const,
  transaction: (websiteId: string, id: string) => [...revenueKeys.all, 'transaction', websiteId, id] as const,
};

export function useRevenueTransaction(websiteId: string, transactionId: string) {
  return useQuery({
    queryKey: revenueKeys.transaction(websiteId, transactionId),
    queryFn: () => getRevenueTransaction(websiteId, transactionId),
    enabled: isValidId(websiteId) && !!transactionId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useRevenueDashboard(websiteId: string, days: number = 30) {
  return useQuery({
    queryKey: revenueKeys.dashboard(websiteId, days),
    queryFn: () => getRevenueDashboard(websiteId, days),
    enabled: isValidId(websiteId),
    staleTime: 5 * 60 * 1000,
  });
}

export function formatMoney(value: number, currency: string = 'USD', locale: string = 'en-US') {
  return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
}
