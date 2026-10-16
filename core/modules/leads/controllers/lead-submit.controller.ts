import type { Context } from "hono";
import { env } from "../../../config";
import { takeRateToken } from "../../../platform/cache/token-bucket";
import { getClientIp } from "../../../platform/http/client-ip";
import { originFromRequest, validateOriginDomain } from "../../../platform/http/origin";
import { log } from "../../../platform/observability/logger";
import type { TrackerWebsites } from "../../websites/interfaces";
import type { LeadCapture } from "../interfaces";
import { cleanText, normalizeEmail, sanitizeFields } from "../lib/sanitize";
import { leadSubmitSchema } from "../validators/lead.schema";

export type LeadSubmitDeps = {
  capture: LeadCapture;
  trackerWebsites: TrackerWebsites;
};

/** A form is a few hundred bytes; anything near this is not one. */
export const MAX_BODY_BYTES = 16 * 1024;
/** Per visitor IP, per website: generous for a person, tight for a script. */
const SUBMITS_PER_WINDOW = 5;
const WINDOW_MS = 60_000;

/**
 * `POST /api/v1/tracker/leads` — the anonymous endpoint a popup form posts to.
 *
 * Everything on this path is hostile until proven otherwise, so the order matters:
 * size, then shape, then the cheap bot signals, then the website, then the rate limit.
 * A honeypot hit and a rate-limited bot both get an `ok` where possible so a script
 * learns nothing about which check caught it; only genuinely malformed requests and
 * unknown sites get an error, because those help a real integrator debug.
 */
export function submitLead(deps: LeadSubmitDeps) {
  return async (c: Context) => {
    const raw = await c.req.text();
    if (raw.length > MAX_BODY_BYTES) return c.json({ error: "payload too large" }, 413);

    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return c.json({ error: "invalid json" }, 400);
    }
    const parsed = leadSubmitSchema.safeParse(json);
    if (!parsed.success) return c.json({ error: "invalid submission" }, 400);
    const body = parsed.data;

    // Honeypot: real visitors cannot see the field, so any value is a bot. Acknowledge it.
    if (body.hp) return c.json({ status: "ok" });

    const website = await deps.trackerWebsites.resolve(body.website_id);
    if (!website || !website.is_active) return c.json({ error: "website not found or inactive" }, 404);
    if (!validateOriginDomain(originFromRequest(c.req.raw.headers), website.url, env().environment)) {
      return c.json({ error: "domain mismatch" }, 403);
    }
    // Same switch as the popups that post here: off means nothing is collected.
    if (!website.automation_enabled) return c.json({ status: "ok" });

    const ip = getClientIp(c, env().trustProxy);
    if (!takeRateToken(`lead:${website.id}:${ip}`, SUBMITS_PER_WINDOW, WINDOW_MS).allowed) {
      return c.json({ status: "ok" });
    }

    try {
      const { prize } = await deps.capture.capture({
        websiteId: website.id,
        email: normalizeEmail(body.email),
        name: cleanText(body.name, 200),
        phone: cleanText(body.phone, 50),
        consent: body.consent === true,
        fields: sanitizeFields(body.fields),
        anonymousId: cleanText(body.anonymous_id, 128) || null,
        sessionId: cleanText(body.session_id, 128) || null,
        automationId: body.automation_id ?? null,
        variant: cleanText(body.variant, 64) || null,
        pageUrl: cleanText(body.page_url, 2048),
        referrer: cleanText(body.referrer, 2048),
        clientIp: ip,
        userAgent: (c.req.header("user-agent") ?? "").slice(0, 500),
        ad: body.ad ?? null,
      });
      // The prize is the one thing the visitor is told: a wheel animates to it and a coupon
      // shows its code. Nothing else about the stored contact is ever returned.
      return c.json({ status: "ok", ...(prize ? { prize } : {}) });
    } catch (err) {
      log.error({ msg: "lead_capture_failed", websiteId: website.id, err });
      return c.json({ error: "could not save submission" }, 500);
    }
  };
}
