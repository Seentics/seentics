import type { Context } from "hono";
import { env } from "../../../config";
import type { TrackerCollectBody } from "../interfaces";
import { clientIpForIngest } from "../../../platform/http/client-ip";
import { needsAnonymizing } from "../lib/anonymous-batch";
import { visitorCountry } from "../../../platform/http/analytics-ingest-meta";
import { requiresConsent } from "../../../platform/privacy/consent-region";
import { originFromRequest, validateOriginDomain } from "../../../platform/http/origin";
import { isBotUserAgent } from "../../../platform/http/bot-user-agent";
import { alreadyStored, markStored } from "../lib/seen-batches";
import { validationErrorResponse } from "../../../platform/validation";
import { trackerCollectSchema } from "../validators/tracker.schema";
import {
  readTrackerCollectBody,
  trackerCollectRequestItemCount,
} from "./tracker-collect-request";
import type { TrackerControllerDeps } from "./tracker-controller.types";

export function collectTracker(deps: TrackerControllerDeps) {
  return async (c: Context) => {
    const cfg = env();
    // Crawlers, link previews, monitors and scripts that run the tracker are not visitors: nothing
    // of theirs is stored or counted toward the site's quota. 200, so they do not retry.
    if (isBotUserAgent(c.req.header("user-agent"), { production: cfg.isProduction })) {
      return c.json({ status: "ok", message: "ignored" });
    }
    let body: TrackerCollectBody;
    try {
      const parsed = trackerCollectSchema.safeParse(await readTrackerCollectBody(c.req.raw));
      if (!parsed.success) return validationErrorResponse(c, parsed.error);
      body = parsed.data as unknown as TrackerCollectBody;
    } catch {
      return c.json({ error: "invalid request body" }, 400);
    }

    const websiteId = typeof body.website_id === "string" ? body.website_id.trim() : "";
    if (!websiteId) return c.json({ error: "website_id is required" }, 400);
    if (trackerCollectRequestItemCount(body) === 0) {
      return c.json({ status: "ok", message: "nothing to process" });
    }

    const website = await deps.trackerWebsites.resolve(websiteId);
    if (!website || !website.is_active) {
      return c.json({ error: "website not found or inactive" }, 404);
    }
    const origin = originFromRequest(c.req.raw.headers);
    if (!validateOriginDomain(origin, website.url, cfg.environment)) {
      return c.json({ error: "domain mismatch" }, 403);
    }
    // A retry of a batch already taken (lib/seen-batches.ts): accepted, not stored again.
    const batchId = (body as Record<string, unknown>).batch_id;
    if (alreadyStored(website.id, batchId)) return c.json({ status: "ok", message: "duplicate" });

    const consentGranted = (body as Record<string, unknown>).consent === true;
    const clientIp = clientIpForIngest(c, cfg.trustProxy, cfg.isProduction);
    // Decided here, from the request, never from the body: the tracker's own idea of the
    // visitor's region does not get to turn anonymisation off.
    const consentRegion = requiresConsent(visitorCountry(c.req.raw.headers, clientIp));
    const result = deps.collect.process({
      body,
      website,
      websiteParam: websiteId,
      origin,
      headers: c.req.raw.headers,
      clientIp,
      diagnosticLog: cfg.diagnosticLog,
      anonymousSalt: needsAnonymizing(website.consent_mode, consentGranted, (body as Record<string, unknown>).anonymous === true, consentRegion)
        ? await deps.visitorSalt()
        : undefined,
    });
    markStored(website.id, batchId);
    if (result.kind === "empty") return c.json({ status: "ok", message: "nothing to process" });
    if (result.kind === "privacy-disabled") {
      return c.json({ status: "ok", message: "tracking disabled by privacy policy" });
    }
    return c.json({
      status: "ok",
      message: "processed",
      queued: result.queued,
      dropped: result.dropped,
    });
  };
}
