/**
 * The embed API: what an iframed dashboard reads. Base path `/api/v1/embed`.
 *
 * Authenticated by an embed link's token (`X-Embed-Token`, or `?token=` for a plain
 * link): permanent until the link is revoked. A website-scope token reads that website; a
 * client-scope token reads the client's website list and any website of that client. The
 * id is in the path as well, so the gateway can refuse a suspended owner's embeds before
 * they reach here.
 *
 * Each link chooses the sections it exposes (`embed_links.sections`, read from the row on
 * every request). A valid token whose link lacks the route's section gets 403
 * `embed_section_disabled`; a bad token always gets the same 401, checked first.
 *
 *   GET /:websiteId/info               the website's name and url, and the link's sections
 *   GET /:websiteId/analytics/:name    [analytics] the dashboard's read endpoint `:name`
 *   GET /:websiteId/replays            [recordings] = GET /replays/:websiteId
 *   GET /:websiteId/replays/:sessionId [recordings] = GET /replays/:websiteId/:sessionId
 *   GET /:websiteId/heatmaps/pages            [heatmaps] = GET /heatmaps/:websiteId/pages
 *   GET /:websiteId/heatmaps/data             [heatmaps] = GET /heatmaps/:websiteId/data
 *   GET /:websiteId/heatmaps/layout-snapshot  [heatmaps] = GET /heatmaps/:websiteId/layout-snapshot
 *   GET /client/:clientId/websites     a client's websites, for the embed's site switcher
 *
 * Reads only: no deletes, no captures, no exports. Anything else is 404.
 */

import { Hono } from "hono";
import { z } from "zod";
import type { EmbedSection } from "../../../modules/api-keys/interfaces";
import type { EmbedClaim, EmbedLinks } from "../../../modules/api-keys/interfaces";
import type { AnalyticsReads } from "../../../modules/analytics/interfaces";
import type { ClientDirectory, WebsiteQuery } from "../../../modules/websites/interfaces";
import type { RecordingsModule } from "../../../modules/recordings/interfaces";
import type { HeatmapsModule } from "../../../modules/heatmaps/interfaces";
import { replayListQuerySchema } from "../../../modules/recordings/interfaces";
import {
  heatmapDataQuerySchema,
  heatmapPagesQuerySchema,
  heatmapSnapshotQuerySchema,
} from "../../../modules/heatmaps/interfaces";
import { log } from "../../../platform/observability/logger";
import { parseQuery } from "../../../platform/validation";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

const tokenQuerySchema = z.object({ token: z.string().optional() });

const invalidToken = () => ({ error: "Invalid or expired embed token", code: "invalid_embed_token" }) as const;

const sectionDisabled = () => ({ error: "section not enabled for this link", code: "embed_section_disabled" }) as const;

export function createEmbedRoutes(deps: {
  embedLinks: EmbedLinks;
  clients: ClientDirectory;
  analytics: AnalyticsReads;
  websites: WebsiteQuery;
  recordings: RecordingsModule["reads"];
  heatmaps: HeatmapsModule["reads"];
}) {
  const r = new Hono();

  /** The client, when it is still the link owner's and in service. */
  const liveClient = async (claim: EmbedClaim, clientId: string) => {
    const client = await deps.clients.getClient(claim.ownerId, clientId);
    return client && client.status === "active" ? client : null;
  };

  r.get("/client/:clientId/websites", async (c) => {
    const q = parseQuery(c, tokenQuerySchema);
    if (!q.ok) return q.res;
    const clientId = c.req.param("clientId");

    const claim = await deps.embedLinks.verify(c.req.header("X-Embed-Token") ?? q.data.token);
    if (!claim || claim.scope !== "client" || claim.targetId !== clientId) return c.json(invalidToken(), 401);
    const client = await liveClient(claim, clientId);
    if (!client) return c.json(invalidToken(), 401);

    c.header("Cache-Control", "private, max-age=60");
    return c.json({
      data: {
        client: { name: client.name },
        sections: claim.sections,
        websites: client.websites.map((w) => ({ id: w.id, name: w.name, url: w.url })),
      },
    });
  });

  /**
   * The website, when the token may read it. One answer (null) for missing, revoked, forged
   * and wrong-target tokens: the embed shows the same "link no longer works" state for all
   * of them, and a caller learns nothing from which.
   */
  const authorizeSite = async (token: string | undefined, websiteId: string) => {
    const claim = await deps.embedLinks.verify(token);
    if (!claim) return null;
    const website = await deps.websites.getById(websiteId);
    if (!website) return null;
    // A website link must name this site; a client link covers the sites its owner filed
    // under that client, while the client is in service.
    const allowed =
      claim.scope === "website"
        ? claim.targetId === websiteId
        : website.clientId === claim.targetId &&
          website.ownerId === claim.ownerId &&
          (await liveClient(claim, claim.targetId)) !== null;
    return allowed ? { website, claim } : null;
  };

  r.get("/:websiteId/info", async (c) => {
    const q = parseQuery(c, tokenQuerySchema);
    if (!q.ok) return q.res;
    const auth = await authorizeSite(c.req.header("X-Embed-Token") ?? q.data.token, c.req.param("websiteId"));
    if (!auth) return c.json(invalidToken(), 401);
    c.header("Cache-Control", "private, max-age=60");
    return c.json({ data: { website: { name: auth.website.name, url: auth.website.url }, sections: auth.claim.sections } });
  });

  r.get("/:websiteId/analytics/:name", async (c) => {
    const q = parseQuery(c, tokenQuerySchema);
    if (!q.ok) return q.res;
    const websiteId = c.req.param("websiteId");
    const name = c.req.param("name");

    // Only the read endpoints the Overview page draws; anything else does not exist here.
    if (!deps.analytics.canEmbedRead(name)) return c.json({ error: "not found" }, 404);

    const auth = await authorizeSite(c.req.header("X-Embed-Token") ?? q.data.token, websiteId);
    if (!auth) return c.json(invalidToken(), 401);
    if (!auth.claim.sections.includes("analytics")) return c.json(sectionDisabled(), 403);

    const data = await deps.analytics.embedRead(name, websiteId, (k) => c.req.query(k));
    // An embed is a page others look at: never let a shared proxy keep it.
    c.header("Cache-Control", name === "live-visitors" ? "no-store" : "private, max-age=60");
    return c.json(data as object);
  });

  /**
   * A read route behind token auth and a section. The token check comes first, so a bad
   * token learns nothing about sections; `handle` runs only for a link that has `section`.
   */
  const sectionRead =
    (section: EmbedSection, cache: string, handle: (c: Context, websiteId: string) => Promise<Response>) =>
    async (c: Context) => {
      const q = parseQuery(c, tokenQuerySchema);
      if (!q.ok) return q.res;
      const websiteId = c.req.param("websiteId")!;
      const auth = await authorizeSite(c.req.header("X-Embed-Token") ?? q.data.token, websiteId);
      if (!auth) return c.json(invalidToken(), 401);
      if (!auth.claim.sections.includes(section)) return c.json(sectionDisabled(), 403);
      const res = await handle(c, websiteId);
      if (res.ok) res.headers.set("Cache-Control", cache);
      return res;
    };

  // ─── Recordings: the dashboard's Recordings list and session player reads ───
  r.get(
    "/:websiteId/replays",
    sectionRead("recordings", "private, no-store", async (c, websiteId) => {
      const query = parseQuery(c, replayListQuerySchema);
      if (!query.ok) return query.res;
      const d = query.data;
      return c.json(
        await deps.recordings.listSessions(websiteId, d.limit, d.offset, {
          search: d.search,
          device: d.device,
          hasErrors: d.has_errors,
          hasRageClicks: d.has_rage_clicks,
          days: d.days,
        }),
      );
    }),
  );

  r.get(
    "/:websiteId/replays/:sessionId",
    sectionRead("recordings", "private, no-store", async (c, websiteId) => {
      const sessionId = c.req.param("sessionId")!;
      try {
        const detail = await deps.recordings.getSessionDetail(websiteId, sessionId);
        return c.json(detail.body, detail.status as ContentfulStatusCode);
      } catch (error) {
        log.error({ category: "recordings", msg: "embed_recording_load_failed", session_id: sessionId, website_id: websiteId, err: error instanceof Error ? error.message : String(error) });
        return c.json({ error: "Failed to load replay" }, 500);
      }
    }),
  );

  // ─── Heatmaps: the dashboard's page list and viewer reads (never save/capture/delete) ───
  r.get(
    "/:websiteId/heatmaps/pages",
    sectionRead("heatmaps", "private, max-age=60", async (c, websiteId) => {
      const query = parseQuery(c, heatmapPagesQuerySchema);
      if (!query.ok) return query.res;
      return c.json(await deps.heatmaps.listPages(websiteId, query.data.days));
    }),
  );

  r.get(
    "/:websiteId/heatmaps/data",
    sectionRead("heatmaps", "private, max-age=60", async (c, websiteId) => {
      const query = parseQuery(c, heatmapDataQuerySchema);
      if (!query.ok) return query.res;
      return c.json(await deps.heatmaps.getPoints(websiteId, query.data.page_path, query.data.event_type || "click", query.data.days));
    }),
  );

  r.get(
    "/:websiteId/heatmaps/layout-snapshot",
    sectionRead("heatmaps", "private, no-store", async (c, websiteId) => {
      const query = parseQuery(c, heatmapSnapshotQuerySchema);
      if (!query.ok) return query.res;
      return c.json(await deps.heatmaps.getLayoutSnapshot(websiteId, query.data.page_path, query.data.device));
    }),
  );

  return r;
}
