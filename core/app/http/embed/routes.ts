/**
 * The embed API: what an iframed dashboard reads. Base path `/api/v1/embed`.
 *
 * Authenticated by an embed token (`X-Embed-Token`, or `?token=` for a plain link) that
 * names one website and expires. The website is in the path as well, so the gateway can
 * refuse a suspended owner's embeds before they reach here, and a token is checked
 * against exactly the site it is used on.
 *
 * One endpoint, one call: everything the embed draws comes back together, so an iframe
 * costs one round trip rather than seven.
 */

import { Hono } from "hono";
import { z } from "zod";
import type { EmbedTokenIssuer } from "../../../modules/api-keys/interfaces";
import type { AnalyticsReads } from "../../../modules/analytics/interfaces";
import type { WebsiteQuery } from "../../../modules/websites/interfaces";
import { parseQuery } from "../../../platform/validation";

const summaryQuerySchema = z.object({
  days: z.enum(["7", "30", "90"]).default("30"),
  token: z.string().optional(),
});

export function createEmbedRoutes(deps: {
  embedTokens: EmbedTokenIssuer;
  analytics: AnalyticsReads;
  websites: WebsiteQuery;
}) {
  const r = new Hono();

  r.get("/:websiteId/summary", async (c) => {
    const q = parseQuery(c, summaryQuerySchema);
    if (!q.ok) return q.res;
    const websiteId = c.req.param("websiteId");

    const claim = await deps.embedTokens.verify(c.req.header("X-Embed-Token") ?? q.data.token);
    // One answer for missing, expired, forged and wrong-site tokens: the embed shows the
    // same "link expired" state for all of them, and a caller learns nothing from which.
    if (!claim || claim.websiteId !== websiteId) {
      return c.json({ error: "Invalid or expired embed token", code: "invalid_embed_token" }, 401);
    }

    const website = await deps.websites.getById(websiteId);
    if (!website) return c.json({ error: "not found" }, 404);

    const query = { days: q.data.days, limit: "8" };
    const [dashboard, daily, pages, referrers, countries, devices] = await Promise.all([
      deps.analytics.getDashboard(websiteId, query),
      deps.analytics.getDailyStats(websiteId, query),
      deps.analytics.getPages(websiteId, query),
      deps.analytics.getReferrers(websiteId, query),
      deps.analytics.getCountries(websiteId, query),
      deps.analytics.getDevices(websiteId, query),
    ]);

    // An embed is a page others look at: never let a shared proxy keep it.
    c.header("Cache-Control", "private, max-age=60");
    return c.json({
      data: {
        website: { name: website.name, url: website.url },
        days: Number(q.data.days),
        dashboard,
        daily,
        top_pages: pages,
        top_referrers: referrers,
        top_countries: countries,
        top_devices: devices,
      },
    });
  });

  return r;
}
