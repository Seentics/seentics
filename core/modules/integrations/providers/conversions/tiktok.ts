import { z } from "zod";
import type { Outcome, ProviderContext } from "../../interfaces";
import type { ConversionPayload, DestinationConfig } from "../../interfaces/conversions";
import type { ConversionProvider } from "./types";

/**
 * TikTok's Events API: `POST /open_api/v1.3/event/track/` with the pixel's access token.
 *
 * Every event is a `web` event for the pixel, with the page, the browser and whatever identifies
 * the person — hashed email, phone and external id, the ad's click id (`ttclid`) and the pixel's
 * browser id (`_ttp`) — and the order id as `event_id`, which is how TikTok drops the copy of
 * the same purchase its browser pixel also reported (the pixel must send it as `event_id`).
 *
 * TikTok answers HTTP 200 to almost everything: whether it took the event is in the body's
 * `code`, 0 for yes.
 */

/** Overridable for the integration suite, which answers as TikTok from a local server. */
const api = () => process.env.CONVERSIONS_TIKTOK_URL || "https://business-api.tiktok.com/open_api/v1.3";

const credentials = z.object({
  pixel_code: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{10,40}$/, "a Pixel ID is letters and digits, like C4ABCD1234EFGH5678"),
  access_token: z.string().trim().min(20).max(1000),
});
type Creds = z.infer<typeof credentials>;

/** No permission on this pixel, or a token that is empty, invalid or expired. */
const AUTH_CODES = new Set([40001, 40104, 40105, 40106]);
/** Rate limits and TikTok's own transient errors. */
const RETRY_CODES = new Set([40100, 40700, 50000, 50002]);

function verdict(text: string): { code: number | null; message: string } {
  try {
    const b = JSON.parse(text) as { code?: number; message?: string };
    return { code: typeof b.code === "number" ? b.code : null, message: (b.message || "TikTok refused the request").slice(0, 300) };
  } catch {
    return { code: null, message: text.replace(/\s+/g, " ").trim().slice(0, 300) || "TikTok refused the request" };
  }
}

function outcome(status: number, text: string): Outcome {
  const { code, message } = verdict(text);
  if (status >= 200 && status < 300 && code === 0) return { kind: "ok", httpStatus: status };
  if (status === 401 || status === 403 || (code !== null && AUTH_CODES.has(code))) {
    return { kind: "failed", retryable: false, auth: true, httpStatus: status, message };
  }
  if (status === 429 || status >= 500 || (code !== null && RETRY_CODES.has(code))) {
    return { kind: "failed", retryable: true, httpStatus: status, message };
  }
  return { kind: "failed", retryable: false, httpStatus: status, message };
}

export function tiktokEvent(p: ConversionPayload): Record<string, unknown> {
  const user: Record<string, unknown> = {};
  if (p.email_sha256) user.email = p.email_sha256;
  if (p.phone_sha256) user.phone = p.phone_sha256;
  if (p.external_id_sha256) user.external_id = p.external_id_sha256;
  if (p.ttclid) user.ttclid = p.ttclid;
  if (p.ttp) user.ttp = p.ttp;
  if (p.ip) user.ip = p.ip;
  if (p.user_agent) user.user_agent = p.user_agent;
  const properties: Record<string, unknown> = {};
  if (p.value !== null) properties.value = p.value;
  if (p.currency) properties.currency = p.currency;
  if (p.order_id) properties.order_id = p.order_id;
  if (p.value !== null) properties.content_type = "product";
  return {
    event: p.platform_event,
    event_time: Math.floor(p.occurred_at / 1000),
    event_id: p.event_id,
    user,
    ...(p.url ? { page: { url: p.url } } : {}),
    ...(Object.keys(properties).length ? { properties } : {}),
  };
}

const post = (c: Creds, data: Record<string, unknown>[], ctx: ProviderContext, testEventCode: string | null = null) =>
  ctx.request({
    method: "POST",
    url: `${api()}/event/track/`,
    headers: { "content-type": "application/json", "access-token": c.access_token },
    body: JSON.stringify({ event_source: "web", event_source_id: c.pixel_code, ...(testEventCode ? { test_event_code: testEventCode } : {}), data }),
  });

export const tiktokProvider: ConversionProvider<Creds> = {
  platform: "tiktok",
  credentialSchema: credentials,
  accountRef: (c) => c.pixel_code,

  // An empty batch: TikTok checks the token and the pixel before it looks at the events, so
  // a refusal for those says the credentials are wrong, and anything else that they are fine —
  // without an event that would count as a conversion.
  async verify(c, ctx) {
    const res = await post(c, [], ctx);
    const { code, message } = verdict(res.text);
    if (res.status === 401 || res.status === 403 || (code !== null && AUTH_CODES.has(code))) {
      return { ok: false as const, message: `TikTok did not accept this Pixel ID and token: ${message}` };
    }
    if (res.status >= 500) return { ok: false as const, message: `TikTok answered HTTP ${res.status}. Try again in a minute.` };
    return { ok: true as const, hint: `Pixel ${c.pixel_code.slice(0, 4)}…${c.pixel_code.slice(-4)}` };
  },

  async send(p, c, _config: DestinationConfig, ctx, testEventCode = null) {
    const res = await post(c, [tiktokEvent(p)], ctx, testEventCode);
    return outcome(res.status, res.text);
  },

  async test(c, config, testEventCode, ctx) {
    const verified = await this.verify(c, ctx);
    if (!verified.ok) return { ok: false, message: verified.message };
    const code = testEventCode || config.test_event_code;
    // Without a test code the event would count as a real conversion: only check the connection.
    if (!code) {
      return { ok: true, message: "Connected to your pixel. Add a test event code (Events Manager → your pixel → Test events) to send a test purchase you can see there." };
    }
    const sample: ConversionPayload = {
      event_id: `seentics-test-${Date.now()}`, platform_event: config.events.purchase ?? "CompletePayment", occurred_at: Date.now(),
      url: "https://seentics.com/test", value: 1, currency: "USD", order_id: null, email_sha256: null, phone_sha256: null,
      external_id_sha256: null, client_id: null, ip: "203.0.113.1", user_agent: "Seentics test event", fbc: null, fbp: null,
    };
    const sent = await this.send(sample, c, config, ctx, code);
    return sent.kind === "ok"
      ? { ok: true, message: "Test event sent. It shows in Events Manager → Test events within a minute." }
      : { ok: false, message: sent.kind === "failed" ? sent.message : "Not sent" };
  },
};
