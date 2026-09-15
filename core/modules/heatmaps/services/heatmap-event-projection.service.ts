import { deviceTypeFromUA } from "../lib/device";
import { heatmapPagePathForEvent } from "../lib/paths";
import type { HeatmapIngestEvent, HeatmapPointRow, ScreenshotJob } from "../interfaces";
import { isJpeg } from "./heatmap-data-normalization.service";

/**
 * Tracker events to storable rows.
 *
 * Split out of `heatmap-ingest.service` because none of it touches the engine's state:
 * these are total functions from an event to a row, and every hostile input the tracker
 * can send — a coordinate that is a string, a viewport of zero, an image that is not a
 * JPEG — is decided here. That made them the part of the engine most worth testing and
 * the part hardest to reach, sitting behind a class that opens a timer in its
 * constructor and needs a bucket, a bus and a website resolver to exist at all.
 *
 * The two scale factors below are a wire contract the dashboard divides by; see
 * `HeatmapPointOut` and `tests/point-scaling.test.ts`.
 */

/** Largest tracker-supplied screenshot accepted. Beyond this it is a bug or an attack. */
const maxScreenshotBytes = 4 << 20;

function toFloat(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function stringVal(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function shortString(v: unknown, max: number): string {
  return stringVal(v).slice(0, max);
}

function finiteInRange(v: unknown, min: number, max: number): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

function objectVal(v: unknown): Record<string, unknown> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function positionMode(v: unknown): "normal" | "fixed" | "sticky" {
  return v === "fixed" || v === "sticky" ? v : "normal";
}

function viewportCap(m: Record<string, unknown> | undefined, key: string): number | null {
  if (!m) return null;
  const v = m[key];
  const f =
    typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : null;
  if (f == null || !Number.isFinite(f)) return null;
  const i = Math.round(f);
  if (i < 100 || i > 10_000) return null; // realistic CSS viewport range
  return i;
}

function decodeScreenshotImage(data: Record<string, unknown> | undefined): Uint8Array | null {
  if (!data) return null;
  let imgStr = stringVal(data.image).trim();
  if (!imgStr) return null;
  const i = imgStr.indexOf("base64,");
  if (i >= 0) imgStr = imgStr.slice(i + 7);
  let buf: Buffer;
  try {
    buf = Buffer.from(imgStr, "base64");
  } catch {
    return null;
  }
  if (buf.length < 400 || buf.length > maxScreenshotBytes || !isJpeg(buf)) return null;
  return buf;
}

/**
 * Turn tracker events into storable cells.
 *
 * The two event types share `x_percent`/`y_percent` but not their scale: a click is
 * stored at 10000× (so the heatmap does not band at 1% granularity) and a scroll depth
 * at 100×. Readers must divide by the matching factor — see `HeatmapPointOut`.
 *
 * The two factors are a wire contract the dashboard divides by, written down nowhere the
 * compiler can check, so a change here has to fail `tests/point-scaling.test.ts` rather
 * than a rendered heatmap.
 */
export function eventsToPoints(events: HeatmapIngestEvent[]): HeatmapPointRow[] {
  const points: HeatmapPointRow[] = [];
  for (const ev of events) {
    const ua = ev.clientUa ?? "";
    const device = deviceTypeFromUA(ua);
    const data = ev.data ?? {};
    const pagePath = heatmapPagePathForEvent(ev.url ?? "", data);

    if (ev.type === "heatmap_click") {
      const nx = Math.min(1, Math.max(0, toFloat(data.nx)));
      const ny = Math.min(1, Math.max(0, toFloat(data.ny)));
      points.push({
        websiteId: ev.websiteId,
        pagePath,
        eventType: "click",
        deviceType: device,
        xPercent: Math.round(nx * 10000),
        yPercent: Math.round(ny * 10000),
        targetSelector: stringVal(data.target),
        capVw: viewportCap(data, "vw"),
        capVh: viewportCap(data, "vh"),
        pageVersion: shortString(data.page_version, 160),
        targetLocator: objectVal(data.target_locator),
        targetRect: objectVal(data.target_rect),
        relativeX: finiteInRange(data.relative_x, 0, 1),
        relativeY: finiteInRange(data.relative_y, 0, 1),
        positionMode: positionMode(data.position_mode),
        clientX: finiteInRange(data.client_x, -100_000, 100_000),
        clientY: finiteInRange(data.client_y, -100_000, 100_000),
        pageX: finiteInRange(data.page_x, -100_000, 10_000_000),
        pageY: finiteInRange(data.page_y, -100_000, 10_000_000),
        scrollX: finiteInRange(data.scroll_x, -100_000, 10_000_000),
        scrollY: finiteInRange(data.scroll_y, -100_000, 10_000_000),
        documentWidth: viewportCap(data, "document_width"),
        documentHeight: finiteInRange(data.document_height, 100, 1_000_000),
        devicePixelRatio: finiteInRange(data.device_pixel_ratio, 0.1, 16),
        trackerVersion: shortString(data.tracker_version, 32),
        schemaVersion: Math.trunc(finiteInRange(data.schema_version, 1, 100) ?? 1),
      });
    } else if (ev.type === "heatmap_scroll") {
      const depth = Math.min(1, Math.max(0, toFloat(data.depth)));
      points.push({
        websiteId: ev.websiteId,
        pagePath,
        eventType: "scroll",
        deviceType: device,
        xPercent: 0,
        yPercent: Math.round(depth * 100),
        targetSelector: "",
        capVw: viewportCap(data, "vw"),
        capVh: viewportCap(data, "vh"),
        pageVersion: shortString(data.page_version, 160),
        targetLocator: null,
        targetRect: null,
        relativeX: null,
        relativeY: null,
        positionMode: "normal",
        clientX: null,
        clientY: null,
        pageX: null,
        pageY: null,
        scrollX: null,
        scrollY: null,
        documentWidth: viewportCap(data, "document_width"),
        documentHeight: finiteInRange(data.document_height, 100, 1_000_000),
        devicePixelRatio: finiteInRange(data.device_pixel_ratio, 0.1, 16),
        trackerVersion: shortString(data.tracker_version, 32),
        schemaVersion: Math.trunc(finiteInRange(data.schema_version, 1, 100) ?? 1),
      });
    }
  }
  return points;
}

export function eventsToScreenshotJobs(websiteId: string, events: HeatmapIngestEvent[]): ScreenshotJob[] {
  const jobs: ScreenshotJob[] = [];
  for (const ev of events) {
    if (ev.type !== "heatmap_screenshot") continue;
    const raw = decodeScreenshotImage(ev.data);
    if (!raw) continue;
    const dm = ev.data ?? {};
    let dw = Math.trunc(ev.docW ?? 0);
    let dh = Math.trunc(ev.docH ?? 0);
    const dwData = toInt(dm.doc_w);
    const dhData = toInt(dm.doc_h);
    if (dwData > 0) dw = dwData;
    if (dhData > 0) dh = dhData;
    jobs.push({
      websiteId: ev.websiteId,
      heatmapLayoutEnabled: ev.heatmapLayoutEnabled ?? false,
      url: ev.url ?? "",
      jpeg: raw,
      docW: dw,
      docH: dh,
    });
  }
  return jobs;
}

function toInt(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string") {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}
