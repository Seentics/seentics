import { z } from "zod";
import type { Outcome, ProviderContext } from "../../interfaces";
import type { ConversionPayload, DestinationConfig } from "../../interfaces/conversions";
import type { ConversionProvider } from "./types";

/**
 * Google Analytics 4's Measurement Protocol: `POST /mp/collect?measurement_id&api_secret`.
 *
 * GA4 attributes an event to a visitor by `client_id`. Taken from the `_ga` cookie when the
 * site also runs gtag, the event joins that visitor's sessions and their ad click; otherwise
 * it is the Seentics visitor id and GA4 counts the conversion under a visitor of its own.
 * Hashed email and phone go as user-provided data. A purchase's `transaction_id` is the order
 * id, which is how GA4 drops a duplicate of a purchase gtag also sent.
 *
 * The collect endpoint answers 2xx to almost anything, so it cannot confirm an API secret;
 * the debug endpoint validates the event's shape.
 */

/** Overridable for the integration suite, which answers as Google from a local server. */
const mp = () => process.env.CONVERSIONS_GA4_URL || "https://www.google-analytics.com";

const credentials = z.object({
  measurement_id: z.string().trim().toUpperCase().regex(/^G-[A-Z0-9]{4,20}$/, "a Measurement ID looks like G-XXXXXXX"),
  api_secret: z.string().trim().min(10).max(200),
});
type Creds = z.infer<typeof credentials>;

const url = (path: string, c: Creds) =>
  `${mp()}${path}?measurement_id=${encodeURIComponent(c.measurement_id)}&api_secret=${encodeURIComponent(c.api_secret)}`;

/** GA4 event names: letters, digits and underscores, starting with a letter, at most 40. */
const ga4Name = (n: string) => n.replace(/[^A-Za-z0-9_]/g, "_").replace(/^[^A-Za-z]+/, "").slice(0, 40) || "conversion";

export function ga4Body(p: ConversionPayload, debug = false): Record<string, unknown> {
  const params: Record<string, unknown> = { engagement_time_msec: 1 };
  if (p.value !== null) params.value = p.value;
  if (p.currency) params.currency = p.currency;
  if (p.order_id) params.transaction_id = p.order_id;
  if (p.url) params.page_location = p.url.slice(0, 1000);
  if (debug) params.debug_mode = true;
  const user: Record<string, unknown> = {};
  if (p.email_sha256) user.sha256_email_address = [p.email_sha256];
  if (p.phone_sha256) user.sha256_phone_number = [p.phone_sha256];
  return {
    client_id: p.client_id ?? "seentics.unknown",
    timestamp_micros: p.occurred_at * 1000,
    ...(Object.keys(user).length ? { user_data: user } : {}),
    events: [{ name: ga4Name(p.platform_event), params }],
  };
}

function outcome(status: number, text: string): Outcome {
  if (status >= 200 && status < 300) return { kind: "ok", httpStatus: status };
  const message = `Google Analytics answered HTTP ${status}${text ? `: ${text.replace(/\s+/g, " ").slice(0, 200)}` : ""}`;
  if (status === 401 || status === 403) return { kind: "failed", retryable: false, auth: true, httpStatus: status, message };
  if (status === 429 || status >= 500) return { kind: "failed", retryable: true, httpStatus: status, message };
  return { kind: "failed", retryable: false, httpStatus: status, message };
}

/** The debug endpoint's verdict: the first validation message, or null when the event is fine. */
async function validate(body: Record<string, unknown>, c: Creds, ctx: ProviderContext): Promise<string | null> {
  const res = await ctx.request({ method: "POST", url: url("/debug/mp/collect", c), headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  if (res.status < 200 || res.status >= 300) return `Google Analytics answered HTTP ${res.status}`;
  try {
    const msgs = (JSON.parse(res.text) as { validationMessages?: { description?: string }[] }).validationMessages ?? [];
    return msgs[0]?.description ?? null;
  } catch {
    return null;
  }
}

const SAMPLE = (config: DestinationConfig): ConversionPayload => ({
  event_id: `seentics-test-${Date.now()}`, platform_event: config.events.purchase ?? "purchase", occurred_at: Date.now(),
  url: "https://seentics.com/test", value: 1, currency: "USD", order_id: `seentics-test-${Date.now()}`, email_sha256: null,
  phone_sha256: null, external_id_sha256: null, client_id: "1234567890.1700000000", ip: null, user_agent: null, fbc: null, fbp: null,
});

export const ga4Provider: ConversionProvider<Creds> = {
  platform: "ga4",
  credentialSchema: credentials,
  accountRef: (c) => c.measurement_id,

  async verify(c, ctx) {
    const problem = await validate(ga4Body(SAMPLE({ events: { purchase: "purchase", lead: null, sign_up: null }, custom: [] })), c, ctx);
    return problem
      ? { ok: false as const, message: `Google Analytics did not accept the test event: ${problem}` }
      : { ok: true as const, hint: c.measurement_id };
  },

  async send(p, c, _config, ctx) {
    if (!p.client_id) return { kind: "skipped", reason: "No visitor id to attribute the event to" };
    const res = await ctx.request({ method: "POST", url: url("/mp/collect", c), headers: { "content-type": "application/json" }, body: JSON.stringify(ga4Body(p)) });
    return outcome(res.status, res.text);
  },

  async test(c, config, _code, ctx) {
    const sample = SAMPLE(config);
    const problem = await validate(ga4Body(sample, true), c, ctx);
    if (problem) return { ok: false, message: `Google Analytics did not accept the test event: ${problem}` };
    const res = await ctx.request({ method: "POST", url: url("/mp/collect", c), headers: { "content-type": "application/json" }, body: JSON.stringify(ga4Body(sample, true)) });
    if (res.status < 200 || res.status >= 300) return { ok: false, message: `Google Analytics answered HTTP ${res.status}` };
    return { ok: true, message: "Test event sent. Open Admin → DebugView in Google Analytics to see it. GA4 cannot confirm the API secret itself: if real conversions do not appear within a day, check it." };
  },
};
