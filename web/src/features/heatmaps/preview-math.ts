/**
 * Geometry and labelling for the heatmap preview.
 *
 * All pure: given points and a viewport width these say how large the document was and
 * what to call the page. They were 150 lines at the top of the detail page, which meant
 * the only way to check the height heuristics was to render the whole route.
 */
import { HEATMAP_DIM_CAP } from '@/lib/heatmaps/preview-geometry';
import { weightedHeatmapCaptureViewportHeight } from '@/features/heatmaps/api';

export type HeatType   = 'click' | 'scroll';
export type DeviceType = 'all' | 'desktop' | 'mobile' | 'tablet';

export function isAbsoluteHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export interface HeatPoint {
  /** 0–1: click `pageX` ÷ document scroll width (same idea as `ny` horizontally). */
  nx:        number;
  /** 0–1: click `pageY` ÷ document scroll height. */
  ny:        number;
  intensity: number;
  selector?: string;
  device?:   string;
  cap_vw?:   number | null;
  cap_vh?:   number | null;
  pageVersion?: string;
  locator?: Record<string, unknown> | null;
  relativeX?: number | null;
  relativeY?: number | null;
  positionMode?: 'normal' | 'fixed' | 'sticky';
  /** How this point was placed on the selected background. */
  mappingMethod?: 'element' | 'fingerprint' | 'coordinate' | 'unmapped';
}

/** Convert one final-depth row per page view into cumulative vertical reach bins. */
export function scrollReachPoints(points: HeatPoint[], bins = 20): HeatPoint[] {
  if (!points.length) return [];
  const count = Math.max(1, Math.min(100, Math.trunc(bins)));
  const out: HeatPoint[] = [];
  for (let i = 0; i <= count; i++) {
    const depth = i / count;
    const reached = points.reduce(
      (sum, p) => sum + (p.ny + 1e-9 >= depth ? Math.max(1, p.intensity) : 0),
      0,
    );
    if (reached > 0 || i === 0) out.push({ nx: 0, ny: depth, intensity: reached });
  }
  return out;
}

export const UUID_SEGMENT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function formatPathSegment(seg: string): string {
  if (/^s[-_]?/i.test(seg) || /^session[-_]/i.test(seg)) {
    return seg.length > 14 ? `Session · ${seg.slice(-8)}` : 'Session';
  }
  if (seg.length > 40) return `${seg.slice(0, 16)}…`;
  return seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, ' ');
}

/** Title skips `websites`, site UUID, and noise; subtitle is the short logical path. */
export function heatmapPageHeading(path: string, websiteId?: string): { title: string; subtitle: string } {
  const segs = path.split('/').filter(Boolean);
  const meaningful = segs.filter(s => {
    if (s === 'websites') return false;
    if (websiteId && s === websiteId) return false;
    if (UUID_SEGMENT.test(s)) return false;
    return true;
  });
  if (!meaningful.length) {
    return { title: 'Heatmap', subtitle: path.startsWith('/') ? path : `/${path}` };
  }
  const title = meaningful.map(formatPathSegment).join(' · ');
  const subtitle = `/${meaningful.join('/')}`;
  return { title, subtitle };
}

/** Logical doc bounds for nx/ny math (keeps coordinates consistent). */

/** Hard cap for canvas + preview layers — larger sizes freeze the tab (multi‑Mpx canvases). */
export const HEATMAP_PREVIEW_MAX_EDGE = 4096;
export const HEATMAP_PREVIEW_MAX_AREA = 10_000_000;

export function clampHeatmapPreviewDimensions(w: number, h: number): { w: number; h: number } {
  let ww = Math.max(1, Math.round(w));
  let hh = Math.max(1, Math.round(h));
  if (ww > HEATMAP_PREVIEW_MAX_EDGE || hh > HEATMAP_PREVIEW_MAX_EDGE) {
    const s = Math.min(HEATMAP_PREVIEW_MAX_EDGE / ww, HEATMAP_PREVIEW_MAX_EDGE / hh);
    ww = Math.max(1, Math.round(ww * s));
    hh = Math.max(1, Math.round(hh * s));
  }
  if (ww * hh > HEATMAP_PREVIEW_MAX_AREA) {
    const s = Math.sqrt(HEATMAP_PREVIEW_MAX_AREA / (ww * hh));
    ww = Math.max(1, Math.round(ww * s));
    hh = Math.max(1, Math.round(hh * s));
  }
  return { w: ww, h: hh };
}

/**
 * Lower bound for preview height from click/scroll spread before a DOM snapshot size is known.
 * Clicks alone only imply height up to max(ny); real pages are often several viewports tall.
 */
export function heatmapDocHeightHintPx(
  points: HeatPoint[],
  heatType: HeatType,
  portWidth: number,
): number {
  const dataH = documentPixelHeightForHeatmap(points, heatType, portWidth, null);
  const wh = weightedHeatmapCaptureViewportHeight(points);
  let vhRef = wh;
  if (vhRef == null || vhRef < 200) {
    let maxVh = 0;
    for (const p of points) {
      const v = p.cap_vh;
      if (typeof v === 'number' && Number.isFinite(v) && v > maxVh) maxVh = v;
    }
    vhRef = maxVh >= 200 ? maxVh : 900;
  }
  const stacks = heatType === 'scroll' ? 6 : 5;
  const fromVh = Math.round(vhRef * stacks);
  let maxDepth = 0;
  if (heatType === 'scroll' && points.length) {
    maxDepth = Math.max(...points.map(p => p.ny), 0);
  }
  const scrollGrow =
    heatType === 'scroll' && maxDepth > 0.01
      ? Math.round(vhRef / Math.max(0.08, 1 - maxDepth))
      : 0;
  return Math.min(
    HEATMAP_DIM_CAP,
    Math.max(dataH, fromVh, scrollGrow, Math.round(Math.max(320, portWidth) * 1.05)),
  );
}

/**
 * Pixel height for the heat layer. Clicks use ny ∈ [0,1] over the *full* document; height must
 * represent that full range for dots to line up (not just max(ny)).
 */
export function documentPixelHeightForHeatmap(
  points: HeatPoint[],
  heatType: HeatType,
  portWidth: number,
  snapshotDocPx: number | null,
): number {
  const w = Math.max(320, portWidth);
  const minH = 200;
  if (snapshotDocPx != null && snapshotDocPx >= minH) {
    return Math.round(snapshotDocPx);
  }
  if (!points.length) {
    return Math.max(minH, Math.round(Math.min(w * 2, 1600)));
  }
  const pad = heatType === 'scroll' ? 0.04 : 0.1;
  const maxNyRaw = Math.max(...points.map(p => p.ny), heatType === 'scroll' ? 0.05 : 0.08);
  // Don't force bottom ≥ 1 before we have snapshot/doc metrics — avoids inflated shells on sparse data.
  const bottom = heatType === 'click'
    ? Math.min(1.55, Math.max(0.08, maxNyRaw + pad))
    : Math.min(1.55, Math.max(0.1, maxNyRaw + pad));
  const scale = Math.max(480, Math.min(1400, w * 1.85));
  return Math.min(HEATMAP_DIM_CAP, Math.max(minH, Math.ceil(bottom * scale)));
}

/** Floor width from click spread when document width is otherwise underestimated. */
export function documentPixelWidthForHeatmap(points: HeatPoint[], portWidth: number): number {
  const w = Math.max(320, portWidth);
  if (!points.length) return w;
  const pad = 0.1;
  const maxNxRaw = Math.max(...points.map(p => p.nx), 0.08);
  const right = Math.min(1.55, Math.max(0.1, maxNxRaw + pad));
  const scale = Math.max(480, Math.min(1400, w * 1.85));
  return Math.min(HEATMAP_DIM_CAP, Math.max(w, Math.ceil(right * scale)));
}

// ─── Heatmap canvas renderer ──────────────────────────────────────────────────
// Two-pass: draw grayscale intensity map then apply colour ramp.
