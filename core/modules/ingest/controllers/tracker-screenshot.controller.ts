import type { Context } from "hono";
import { env } from "../../../config";
import {
  originFromRequest,
  validateOriginDomainStrict,
  validateScreenshotTargetUrl,
} from "../../../platform/http/origin";
import { isAutomatedRequest } from "../../../platform/http/automated-request";
import {
  DEFAULT_SCREENSHOT_REQUEST_LIMITS,
  MAX_SCREENSHOT_PAGE_URL,
  ScreenshotRequestLimiter,
  screenshotPagePath,
  type ScreenshotRequestLimits,
} from "../lib/screenshot-request-limits";
import type { TrackerControllerDeps } from "./tracker-controller.types";

export function requestTrackerScreenshot(
  deps: TrackerControllerDeps,
  limits: ScreenshotRequestLimits = DEFAULT_SCREENSHOT_REQUEST_LIMITS,
) {
  // One per router, so the daily path sets belong to this mount (and to each test's app).
  const limiter = new ScreenshotRequestLimiter(limits);
  return async (c: Context) => {
    // A crawler's view of a page is not captured as the heatmap's background.
    if (isAutomatedRequest(c)) return c.json({ status: "ok", message: "ignored" });
    let body: Record<string, unknown>;
    try {
      body = (await c.req.json()) as Record<string, unknown>;
    } catch {
      return c.json({ error: "invalid json" }, 400);
    }

    const websiteId = typeof body.website_id === "string" ? body.website_id.trim() : "";
    if (!websiteId) return c.json({ error: "website_id required" }, 400);
    const pageUrl = typeof body.page_url === "string" ? body.page_url.trim() : "";
    const clientPagePath = typeof body.page_path === "string" ? body.page_path.trim() : "";
    if (!pageUrl || !clientPagePath) return c.json({ error: "page_url and page_path required" }, 400);
    if (pageUrl.length > MAX_SCREENSHOT_PAGE_URL) return c.json({ error: "page_url too long" }, 400);
    const pagePath = screenshotPagePath(pageUrl, clientPagePath);
    if (!pagePath) return c.json({ error: "invalid page_url" }, 400);

    const website = await deps.trackerWebsites.resolve(websiteId);
    if (!website || !website.is_active) {
      return c.json({ error: "website not found or inactive" }, 404);
    }
    // Strict: a request with no Origin/Referer at all is refused here, unlike `/collect`.
    const origin = originFromRequest(c.req.raw.headers);
    if (!validateOriginDomainStrict(origin, website.url, env().environment)) {
      return c.json({ error: "domain mismatch" }, 403);
    }
    if (!validateScreenshotTargetUrl(pageUrl, website.url)) {
      return c.json({ error: "page_url not allowed" }, 400);
    }

    // Keyed on the resolved UUID so a site cannot be given two budgets by two references.
    const verdict = limiter.check(website.id, pagePath);
    if (verdict !== "ok") {
      return c.json({ error: verdict === "rate_limited" ? "rate limited" : "daily screenshot limit reached" }, 429);
    }

    void deps.screenshots.capture(websiteId, { pageUrl, pagePath, force: false }).catch(() => {});
    return c.json({ status: "queued" }, 202);
  };
}
