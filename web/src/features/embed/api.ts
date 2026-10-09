import { getApiUrl } from '@/lib/config';
import { demoEmbedSummary, isDemo } from '@/lib/demo';

type Row<K extends string> = Record<K, string> & { views: number; unique: number };

/** What `GET /embed/:websiteId/summary` returns (core `app/http/embed/routes.ts`). */
export type EmbedSummary = {
  website: { name: string; url: string };
  days: number;
  dashboard: {
    total_visitors: number;
    unique_visitors: number;
    page_views: number;
    bounce_rate: number;
    session_duration: number;
    comparison?: { visitor_change?: number; pageview_change?: number; bounce_change?: number; duration_change?: number };
  };
  daily: { daily_stats: { date: string; views: number; unique: number }[] };
  top_pages: { top_pages: Row<'page'>[] };
  top_referrers: { top_referrers: Row<'referrer'>[] };
  top_countries: { top_countries: Row<'country'>[] };
  top_devices: { top_devices: Row<'device'>[] };
};

export class EmbedTokenError extends Error {}

/**
 * Plain `fetch`, not the dashboard's api client: an embed has no session, and that
 * client answers a 401 by redirecting to sign-in — inside someone else's iframe.
 */
export async function fetchEmbedSummary(websiteId: string, token: string, days: number): Promise<EmbedSummary> {
  if (isDemo(websiteId)) return demoEmbedSummary(days) as EmbedSummary;
  const res = await fetch(getApiUrl(`/embed/${websiteId}/summary?days=${days}`), {
    headers: { 'X-Embed-Token': token },
  });
  if (res.status === 401) throw new EmbedTokenError('This embed link has expired.');
  if (!res.ok) throw new Error(`The embed could not load (${res.status}).`);
  return ((await res.json()) as { data: EmbedSummary }).data;
}
