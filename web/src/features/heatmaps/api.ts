import api from '@/lib/api';
import type {
  HeatmapData,
  HeatmapPageScreenshot,
  HeatmapPageSummary,
  HeatmapPoint,
  PlaywrightScreenshotResult,
} from './types';





/** Heatmap date ranges, in days ending today — what the pages list and a heatmap read over. */
export const HEATMAP_RANGES = [
  { days: 1, label: 'Today' },
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
  { days: 90, label: '90 days' },
] as const;
export const DEFAULT_HEATMAP_DAYS = 30;

export async function listHeatmapPages(websiteId: string, days?: number): Promise<HeatmapPageSummary[]> {
  const res = await api.get(`/heatmaps/${websiteId}/pages`, { params: days ? { days } : {} });
  return (res.data?.pages ?? []) as HeatmapPageSummary[];
}

/**
 * Canonical path for API queries — must match Go `extractPath` (pathname only, no query/hash).
 * Otherwise `/` vs `/?utm=…` would fetch zero rows while the list still shows `/`.
 */
export function normalizeHeatmapPagePath(path: string): string {
  let p = (path ?? '').trim();
  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(p) || p.startsWith('//')) {
      const u = new URL(p.startsWith('//') ? `https:${p}` : p);
      p = u.pathname || '/';
    }
  } catch {
    /* plain path */
  }
  if (!p.startsWith('/')) p = `/${p}`;
  const hashIdx = p.indexOf('#');
  if (hashIdx >= 0) p = p.slice(0, hashIdx);
  const qIdx = p.indexOf('?');
  if (qIdx >= 0) p = p.slice(0, qIdx);
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p || '/';
}

export async function getHeatmapData(
  websiteId: string,
  pagePath:  string,
  eventType: 'click' | 'scroll' = 'click',
  days?: number,
): Promise<HeatmapData> {
  const res = await api.get(`/heatmaps/${websiteId}/data`, {
    params: {
      page_path: normalizeHeatmapPagePath(pagePath),
      event_type: eventType,
      ...(days ? { days } : {}),
    },
  });
  return res.data as HeatmapData;
}


/**
 * The page background for one device bucket.
 *
 * `device` matters: a responsive page reflows between buckets, so a desktop capture
 * cannot host mobile points — the same normalized coordinates land on different
 * elements. The server falls back to another bucket rather than returning nothing and
 * flags it as `device_fallback` so the dashboard can say the overlay is approximate.
 */
export async function getHeatmapPageScreenshot(
  websiteId: string,
  pagePath: string,
  device?: string,
): Promise<HeatmapPageScreenshot | null> {
  const res = await api.get(`/heatmaps/${websiteId}/layout-snapshot`, {
    params: {
      page_path: normalizeHeatmapPagePath(pagePath),
      // "all" is a points filter, not a layout — desktop is the widest and most
      // representative background to draw an everything-bucket heatmap on.
      ...(device && device !== 'all' ? { device } : {}),
    },
  });
  const layout = (res.data as { layout?: HeatmapPageScreenshot | null }).layout;
  return layout ?? null;
}
export async function saveDashboardScreenshot(
  websiteId: string,
  pagePath: string,
  imageBase64: string,
  docWidth: number,
  docHeight: number,
): Promise<void> {
  await api.post(`/heatmaps/${websiteId}/save-screenshot`, {
    page_path: normalizeHeatmapPagePath(pagePath),
    image: imageBase64,
    doc_width: docWidth,
    doc_height: docHeight,
  });
}


/**
 * Trigger a server-side Playwright screenshot for the given page.
 * Uses three-tier check: in-memory cache → DB → Playwright (only launches browser if no existing screenshot).
 * Pass `force: true` to re-capture even if a screenshot already exists.
 */
export async function triggerPlaywrightScreenshot(
  websiteId: string,
  pageUrl: string,
  pagePath: string,
  options?: {
    viewportWidth?: number;
    viewportHeight?: number;
    waitForSelector?: string;
    jpegQuality?: number;
    force?: boolean;
    checkOnly?: boolean;
  },
): Promise<PlaywrightScreenshotResult | null> {
  try {
    const res = await api.post(`/heatmaps/${websiteId}/playwright-screenshot`, {
      page_url: pageUrl,
      page_path: normalizeHeatmapPagePath(pagePath),
      viewport_width: options?.viewportWidth,
      viewport_height: options?.viewportHeight,
      wait_for_selector: options?.waitForSelector,
      jpeg_quality: options?.jpegQuality,
      force: options?.force,
      check_only: options?.checkOnly,
    });
    return (res.data?.data ?? null) as PlaywrightScreenshotResult | null;
  } catch {
    return null;
  }
}

export async function deleteHeatmaps(websiteId: string, pagePaths: string[]): Promise<void> {
  await api.delete(`/heatmaps/${websiteId}/bulk-delete`, {
    data: { pagePaths }
  });
}

/** Intensity-weighted mean CSS viewport width from points (matches visitor breakpoints in preview). */
export function weightedHeatmapCaptureViewportWidth(
  points: Pick<HeatmapPoint, 'cap_vw' | 'intensity'>[],
): number | null {
  let sw = 0;
  let iw = 0;
  for (const p of points) {
    const w = p.cap_vw;
    if (typeof w === 'number' && Number.isFinite(w) && w >= 320 && w <= 16_384) {
      const wt = Math.max(1, p.intensity);
      sw += w * wt;
      iw += wt;
    }
  }
  if (iw <= 0) return null;
  return Math.round(sw / iw);
}

/** Intensity-weighted mean CSS viewport height — used when iframe document metrics are unavailable (cross-origin). */
export function weightedHeatmapCaptureViewportHeight(
  points: Pick<HeatmapPoint, 'cap_vh' | 'intensity'>[],
): number | null {
  let sh = 0;
  let iw = 0;
  for (const p of points) {
    const h = p.cap_vh;
    if (typeof h === 'number' && Number.isFinite(h) && h >= 200 && h <= 16_384) {
      const wt = Math.max(1, p.intensity);
      sh += h * wt;
      iw += wt;
    }
  }
  if (iw <= 0) return null;
  return Math.round(sh / iw);
}

/**
 * URL slug segment for `/heatmaps/[slug]`: the page path as base64url.
 *
 * It used to be the path with `/` swapped for `_`, which the detail page undid by turning
 * every `_` back into `/` — so `/pricing_plans` opened `/pricing/plans`. base64url is
 * reversible and has no `/` or `%` to be mangled by a proxy. A path always starts with `/`,
 * so a slug always starts with `L`; an old `_`-slug always starts with `_`, which is how
 * {@link heatmapPathFromSlug} still opens bookmarked links.
 */
export function heatmapPageSlug(pagePath: string): string {
  const bytes = new TextEncoder().encode(normalizeHeatmapPagePath(pagePath));
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** The page path a `/heatmaps/[slug]` segment names — the inverse of {@link heatmapPageSlug}. */
export function heatmapPathFromSlug(slug: string | undefined | null): string {
  if (!slug) return '/';
  let raw = slug;
  try { raw = decodeURIComponent(slug); } catch { /* already plain */ }
  // A pre-base64 link: `_` stood for `/`, so underscores in the path are lost either way.
  const legacy = () => normalizeHeatmapPagePath(raw.replace(/_/g, '/'));
  if (raw.startsWith('_')) return legacy();
  try {
    const b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    const path = new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, (c) => c.charCodeAt(0)));
    return path.startsWith('/') ? normalizeHeatmapPagePath(path) : legacy();
  } catch {
    return legacy();
  }
}
