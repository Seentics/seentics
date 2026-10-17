import { takeRateToken } from "../../../platform/cache/token-bucket";

/**
 * Bounds on the anonymous `/request-screenshot` endpoint.
 *
 * It is unauthenticated by nature — the tracker runs on a visitor's browser — and each
 * accepted request can launch a headless browser and write an object to storage. The origin
 * check keeps honest browsers on their own site, but any client can set `Origin`, so these
 * caps are what actually bound the cost one website id can be made to incur.
 *
 * Both are process-local: N instances allow N times the budget. That is acceptable for a
 * cost bound — the point is that the ceiling is finite, not that it is exact.
 */
export type ScreenshotRequestLimits = {
  /** Requests per website per minute, accepted or deduped alike. */
  perMinute: number;
  /** Distinct page paths per website per UTC day that may be handed to capture. */
  newPathsPerDay: number;
};

export const DEFAULT_SCREENSHOT_REQUEST_LIMITS: ScreenshotRequestLimits = {
  perMinute: 10,
  newPathsPerDay: 50,
};

/** Longest page path kept; a real route is far shorter, and the path keys storage. */
export const MAX_SCREENSHOT_PAGE_PATH = 512;
/** Longest page URL accepted — the usual browser/CDN practical limit. */
export const MAX_SCREENSHOT_PAGE_URL = 2048;

export type ScreenshotRequestVerdict = "ok" | "rate_limited" | "daily_cap";

/**
 * Per-website request rate (the shared token bucket) plus a per-day cap on distinct paths.
 *
 * The daily set counts paths, not requests: asking again for a path already seen today costs
 * nothing new — capture dedupes on the stored snapshot — so it is always allowed through. Its
 * memory is bounded by `newPathsPerDay` per website, and only websites that resolved as active
 * ever get an entry.
 */
export class ScreenshotRequestLimiter {
  private readonly days = new Map<string, { day: string; paths: Set<string> }>();

  constructor(private readonly limits: ScreenshotRequestLimits = DEFAULT_SCREENSHOT_REQUEST_LIMITS) {}

  check(websiteId: string, normalizedPath: string, now = new Date()): ScreenshotRequestVerdict {
    if (!takeRateToken(`tracker-screenshot:${websiteId}`, this.limits.perMinute, 60_000).allowed) {
      return "rate_limited";
    }
    const day = now.toISOString().slice(0, 10);
    let entry = this.days.get(websiteId);
    if (!entry || entry.day !== day) {
      entry = { day, paths: new Set() };
      this.days.set(websiteId, entry);
    }
    if (entry.paths.has(normalizedPath)) return "ok";
    if (entry.paths.size >= this.limits.newPathsPerDay) return "daily_cap";
    entry.paths.add(normalizedPath);
    return "ok";
  }
}

/** The tracker's `data-seentics-page` override — same shape heatmaps accepts as a page key. */
const PAGE_KEY_OVERRIDE = /^\/@[a-z0-9][a-z0-9._-]*$/i;

/**
 * The page path a screenshot request is filed under, or null if it cannot be one.
 *
 * Derived from `page_url`, not taken from the client's `page_path`. The two used to be
 * independent, so one URL could be requested under unlimited free-text paths — each a fresh
 * snapshot row and storage object, because dedupe keys on the path. Query and fragment are
 * dropped (`URL.pathname` never carries them) and the result is length-capped. The only
 * client path still honoured is the explicit `/@key` page override, which by its shape
 * cannot carry anything else.
 */
export function screenshotPagePath(pageUrl: string, clientPagePath: string): string | null {
  const override = clientPagePath.trim();
  if (override.length <= 160 && PAGE_KEY_OVERRIDE.test(override)) return override;
  let path: string;
  try {
    path = new URL(pageUrl).pathname || "/";
  } catch {
    return null;
  }
  if (path.length > MAX_SCREENSHOT_PAGE_PATH) return null;
  return path;
}
