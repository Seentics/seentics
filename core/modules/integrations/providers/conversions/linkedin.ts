import { z } from "zod";
import type { Outcome, ProviderContext } from "../../interfaces";
import type { ConversionPayload, DestinationConfig } from "../../interfaces/conversions";
import type { ConversionProvider } from "./types";

/**
 * LinkedIn's Conversions API: `POST /rest/conversionEvents` with an access token that has the
 * `rw_conversions` scope.
 *
 * LinkedIn has no standard event names: each event goes to a conversion rule the owner made in
 * Campaign Manager (source "Conversions API"), by the rule's id, so a destination's mapping holds
 * rule ids. It matches a person by hashed email and its own first-party click id (`li_fat_id`)
 * only; an event with neither cannot be attributed and is not sent. The event id lets LinkedIn
 * drop the copy the Insight Tag also reported.
 */

/** Overridable for the integration suite, which answers as LinkedIn from a local server. */
const api = () => process.env.CONVERSIONS_LINKEDIN_URL || "https://api.linkedin.com/rest";
/** LinkedIn's versioned API: a month it still serves (each is kept for about a year). */
const version = () => process.env.CONVERSIONS_LINKEDIN_VERSION || "202608";

const credentials = z.object({
  ad_account_id: z.string().trim().regex(/^\d{5,20}$/, "an ad account ID is a number"),
  access_token: z.string().trim().min(20).max(2000),
});
type Creds = z.infer<typeof credentials>;

const headers = (c: Creds, json = false): Record<string, string> => ({
  authorization: `Bearer ${c.access_token}`,
  "linkedin-version": version(),
  "x-restli-protocol-version": "2.0.0",
  ...(json ? { "content-type": "application/json" } : {}),
});

const RULE_ID = /^\d{1,20}$/;

function errorOf(text: string): string {
  try {
    const m = (JSON.parse(text) as { message?: string }).message;
    if (m) return m.slice(0, 300);
  } catch { /* not JSON */ }
  return text.replace(/\s+/g, " ").trim().slice(0, 300) || "LinkedIn refused the request";
}

function outcome(status: number, text: string): Outcome {
  if (status >= 200 && status < 300) return { kind: "ok", httpStatus: status };
  const message = errorOf(text);
  if (status === 401 || status === 403) return { kind: "failed", retryable: false, auth: true, httpStatus: status, message };
  if (status === 429 || status >= 500) return { kind: "failed", retryable: true, httpStatus: status, message };
  return { kind: "failed", retryable: false, httpStatus: status, message };
}

/** The request body, or null when nothing identifies the person to LinkedIn. */
export function linkedinEvent(p: ConversionPayload): Record<string, unknown> | null {
  const userIds: { idType: string; idValue: string }[] = [];
  if (p.email_sha256) userIds.push({ idType: "SHA256_EMAIL", idValue: p.email_sha256 });
  if (p.li_fat_id) userIds.push({ idType: "LINKEDIN_FIRST_PARTY_ADS_TRACKING_UUID", idValue: p.li_fat_id });
  if (userIds.length === 0) return null;
  return {
    conversion: `urn:lla:llaPartnerConversion:${p.platform_event}`,
    conversionHappenedAt: p.occurred_at,
    eventId: p.event_id,
    ...(p.value !== null ? { conversionValue: { currencyCode: p.currency ?? "USD", amount: p.value.toFixed(2) } } : {}),
    user: { userIds },
  };
}

/** The ad account's conversion rules by id, or LinkedIn's refusal. */
async function rules(c: Creds, ctx: ProviderContext): Promise<{ ids: Set<string> } | { status: number; message: string }> {
  const account = encodeURIComponent(`urn:li:sponsoredAccount:${c.ad_account_id}`);
  const res = await ctx.request({ method: "GET", url: `${api()}/conversions?q=account&account=${account}&count=100`, headers: headers(c) });
  if (res.status < 200 || res.status >= 300) return { status: res.status, message: errorOf(res.text) };
  try {
    const elements = (JSON.parse(res.text) as { elements?: { id?: number | string }[] }).elements ?? [];
    return { ids: new Set(elements.map((e) => String(e.id ?? ""))) };
  } catch {
    return { ids: new Set() };
  }
}

const refused = (r: { status: number; message: string }) =>
  r.status === 401
    ? `LinkedIn did not accept this access token: ${r.message}`
    : r.status === 403
      ? `This token cannot reach ad account conversions. It needs the rw_conversions scope and access to the account: ${r.message}`
      : `LinkedIn answered HTTP ${r.status}: ${r.message}`;

export const linkedinProvider: ConversionProvider<Creds> = {
  platform: "linkedin",
  credentialSchema: credentials,
  accountRef: (c) => c.ad_account_id,

  async verify(c, ctx) {
    const r = await rules(c, ctx);
    if ("status" in r) return { ok: false as const, message: refused(r) };
    return { ok: true as const, hint: `Ad account ${c.ad_account_id}` };
  },

  async send(p, c, _config: DestinationConfig, ctx) {
    if (!RULE_ID.test(p.platform_event)) {
      return { kind: "failed", retryable: false, message: `"${p.platform_event.slice(0, 40)}" is not a conversion rule ID. Enter the rule's number from Campaign Manager.` };
    }
    const body = linkedinEvent(p);
    if (!body) return { kind: "skipped", reason: "No email or LinkedIn click id to match the person by" };
    const res = await ctx.request({ method: "POST", url: `${api()}/conversionEvents`, headers: headers(c, true), body: JSON.stringify(body) });
    return outcome(res.status, res.text);
  },

  // LinkedIn has no test mode: any event sent counts. The test checks the connection and that
  // every rule the events are mapped to exists in the ad account.
  async test(c, config, _code, ctx) {
    const r = await rules(c, ctx);
    if ("status" in r) return { ok: false, message: refused(r) };
    const mapped = [...Object.values(config.events), ...config.custom.map((m) => m.platform_event)].filter((v): v is string => !!v);
    if (mapped.length === 0) return { ok: false, message: "Connected, but no event is mapped to a conversion rule yet. Edit events and enter the rule IDs from Campaign Manager." };
    const missing = mapped.filter((id) => !r.ids.has(id));
    if (missing.length) return { ok: false, message: `Connected, but ad account ${c.ad_account_id} has no conversion rule ${missing.join(", ")}. Check the IDs in Campaign Manager → Conversion tracking.` };
    return { ok: true, message: `Connected. Ad account ${c.ad_account_id} has every mapped conversion rule. LinkedIn has no test mode, so no event was sent.` };
  },
};
