import { z } from "zod";
import type { Outcome, ProviderContext } from "../../interfaces";
import type { ConversionPayload, DestinationConfig } from "../../interfaces/conversions";
import type { ConversionProvider } from "./types";

/**
 * Meta's Conversions API: `POST /{pixel_id}/events` with a system-user access token.
 *
 * Every event carries `action_source: website`, the page, the browser and whatever identifies
 * the person — hashed email and phone, the click (`fbc`) and browser (`fbp`) ids and a hashed
 * external id — and the order id as `event_id`, which is how Meta drops the copy of the same
 * purchase its browser pixel also reported (the pixel must send the order id as `eventID`).
 */

/** Overridable for the integration suite, which answers as Meta from a local server. */
const graph = () => process.env.CONVERSIONS_META_GRAPH_URL || "https://graph.facebook.com/v21.0";

const credentials = z.object({
  pixel_id: z.string().trim().regex(/^\d{5,20}$/, "a Pixel ID is a number"),
  access_token: z.string().trim().min(20).max(1000),
});
type Creds = z.infer<typeof credentials>;

/** Meta's error body: `{ error: { message, code, error_user_msg } }`. */
function metaError(text: string): { message: string; code: number | null } {
  try {
    const e = (JSON.parse(text) as { error?: { message?: string; error_user_msg?: string; code?: number } }).error;
    if (e) return { message: (e.error_user_msg || e.message || "Meta refused the request").slice(0, 300), code: e.code ?? null };
  } catch { /* not JSON */ }
  return { message: text.replace(/\s+/g, " ").trim().slice(0, 300) || "Meta refused the request", code: null };
}

function outcome(status: number, text: string): Outcome {
  if (status >= 200 && status < 300) return { kind: "ok", httpStatus: status };
  const { message, code } = metaError(text);
  // 190: the token is invalid or expired; 10/200: missing permission on the pixel.
  if (code === 190 || code === 10 || code === 200 || status === 401 || status === 403) {
    return { kind: "failed", retryable: false, auth: true, httpStatus: status, message };
  }
  // 4 / 17 / 32 / 613: rate limits; 1 / 2: Meta's own transient errors.
  if (status === 429 || status >= 500 || [1, 2, 4, 17, 32, 613].includes(code ?? -1)) {
    return { kind: "failed", retryable: true, httpStatus: status, message };
  }
  return { kind: "failed", retryable: false, httpStatus: status, message };
}

export function metaEvent(p: ConversionPayload): Record<string, unknown> {
  const user: Record<string, unknown> = {};
  if (p.email_sha256) user.em = [p.email_sha256];
  if (p.phone_sha256) user.ph = [p.phone_sha256];
  if (p.external_id_sha256) user.external_id = [p.external_id_sha256];
  if (p.ip) user.client_ip_address = p.ip;
  if (p.user_agent) user.client_user_agent = p.user_agent;
  if (p.fbc) user.fbc = p.fbc;
  if (p.fbp) user.fbp = p.fbp;
  const custom: Record<string, unknown> = {};
  if (p.value !== null) custom.value = p.value;
  if (p.currency) custom.currency = p.currency;
  if (p.order_id) custom.order_id = p.order_id;
  return {
    event_name: p.platform_event,
    event_time: Math.floor(p.occurred_at / 1000),
    event_id: p.event_id,
    action_source: "website",
    event_source_url: p.url || undefined,
    user_data: user,
    ...(Object.keys(custom).length ? { custom_data: custom } : {}),
  };
}

export const metaProvider: ConversionProvider<Creds> = {
  platform: "meta",
  credentialSchema: credentials,
  accountRef: (c) => c.pixel_id,

  async verify(c, ctx: ProviderContext) {
    const res = await ctx.request({
      method: "GET",
      url: `${graph()}/${c.pixel_id}?fields=id,name&access_token=${encodeURIComponent(c.access_token)}`,
      headers: {},
    });
    if (res.status >= 200 && res.status < 300) {
      let name = "";
      try { name = String((JSON.parse(res.text) as { name?: string }).name ?? ""); } catch { /* fine */ }
      return { ok: true as const, hint: `${name ? `${name.slice(0, 60)} · ` : ""}Pixel ${c.pixel_id}` };
    }
    return { ok: false as const, message: `Meta did not accept this Pixel ID and token: ${metaError(res.text).message}` };
  },

  async send(p, c, _config: DestinationConfig, ctx, testEventCode = null) {
    const res = await ctx.request({
      method: "POST",
      url: `${graph()}/${c.pixel_id}/events`,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ data: [metaEvent(p)], access_token: c.access_token, ...(testEventCode ? { test_event_code: testEventCode } : {}) }),
    });
    return outcome(res.status, res.text);
  },

  async test(c, config, testEventCode, ctx) {
    const verified = await this.verify(c, ctx);
    if (!verified.ok) return { ok: false, message: verified.message };
    const code = testEventCode || config.test_event_code;
    // Without a test code the event would count as a real conversion: only check the connection.
    if (!code) {
      return { ok: true, message: "Connected to your pixel. Add a test event code (Events Manager → Test events) to send a test purchase you can see there." };
    }
    const sample: ConversionPayload = {
      event_id: `seentics-test-${Date.now()}`, platform_event: config.events.purchase ?? "Purchase", occurred_at: Date.now(),
      url: "https://seentics.com/test", value: 1, currency: "USD", order_id: null, email_sha256: null, phone_sha256: null,
      external_id_sha256: null, client_id: null, ip: "203.0.113.1", user_agent: "Seentics test event", fbc: null, fbp: null,
    };
    const sent = await this.send(sample, c, config, ctx, code);
    return sent.kind === "ok"
      ? { ok: true, message: "Test event sent. It shows in Events Manager → Test events within a minute." }
      : { ok: false, message: sent.kind === "failed" ? sent.message : "Not sent" };
  },
};
