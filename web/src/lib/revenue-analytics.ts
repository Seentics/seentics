import { useQuery } from '@tanstack/react-query';
import api from './api';
import { isDemo } from './demo';
import { demoRevenueDashboard as loadDemo } from './demo/revenue';
import { getUserTimezone } from './analytics-api';

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
  items?: Array<{ sku: string; name: string; qty: number; price: number }>;
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

export const revenueKeys = {
  all: ['revenue'] as const,
  dashboard: (websiteId: string, days: number) => [...revenueKeys.all, 'dashboard', websiteId, days] as const,
};

export function useRevenueDashboard(websiteId: string, days: number = 30) {
  return useQuery({
    queryKey: revenueKeys.dashboard(websiteId, days),
    queryFn: () => getRevenueDashboard(websiteId, days),
    enabled: !!websiteId,
    staleTime: 5 * 60 * 1000,
  });
}

export function formatMoney(value: number, currency: string = 'USD', locale: string = 'en-US') {
  return new Intl.NumberFormat(locale, { style: 'currency', currency, maximumFractionDigits: 2 }).format(value);
}
