import { z } from "zod";
import { outcomeFromStatus } from "../lib/http";
import { lastChars } from "../lib/mask";
import type { IntegrationProvider, ProviderContext } from "../interfaces";

const credentialSchema = z.object({
  api_key: z.string().trim().regex(/^pk_[A-Za-z0-9]{20,64}$/, "Use a private API key (it starts with pk_)"),
});
type Credentials = z.infer<typeof credentialSchema>;

const configSchema = z.object({
  /** Optional: also put leads on this list. Without it only a profile is created. */
  list_id: z.string().trim().regex(/^[A-Za-z0-9]{4,16}$/, "Enter the list ID (for example Y6nRLr)").optional().or(z.literal("").transform(() => undefined)),
});
type Config = z.infer<typeof configSchema>;

/** Klaviyo versions its API by date; each value is supported for a long window. */
const REVISION = "2026-07-15";
const API = "https://a.klaviyo.com/api";

const headers = (c: Credentials) => ({
  Authorization: `Klaviyo-API-Key ${c.api_key}`,
  revision: REVISION,
  accept: "application/vnd.api+json",
  "content-type": "application/vnd.api+json",
});

/** Klaviyo rejects a profile whose phone is not E.164, so anything else is left out. */
const e164 = (phone: string) => (/^\+[1-9]\d{6,14}$/.test(phone.replace(/[\s().-]/g, "")) ? phone.replace(/[\s().-]/g, "") : undefined);

async function request(ctx: ProviderContext, c: Credentials, method: "GET" | "POST", path: string, body?: unknown) {
  return ctx.request({ url: `${API}${path}`, method, headers: headers(c), body: body === undefined ? undefined : JSON.stringify(body) });
}

/**
 * Klaviyo: create or update the profile, then, if a list is set, put the lead on it.
 *
 * A profile is created for every lead. List handling follows consent: a lead who ticked the
 * checkbox is *subscribed* to email marketing on the list (the bulk-subscribe job, which is
 * Klaviyo's way of recording consent); one who did not is added to the list as a plain
 * member, with no marketing consent recorded. Both calls are idempotent.
 */
export const klaviyo: IntegrationProvider<Credentials, Config> = {
  id: "klaviyo",
  label: "Klaviyo",
  description: "Create Klaviyo profiles and subscribe consenting leads to a list.",
  docsUrl: "https://developers.klaviyo.com/en/reference/create_or_update_profile",
  fields: [
    { kind: "credential", name: "api_key", label: "Private API key", type: "password", placeholder: "pk_…", help: "Settings > API keys. Needs profiles:write, and lists:write and subscriptions:write for a list.", required: true },
    { kind: "config", name: "list_id", label: "List ID (optional)", type: "text", help: "Lists & Segments > your list > Settings.", required: false },
  ],
  credentialSchema,
  configSchema,
  hint: (c) => lastChars(c.api_key.slice(3)),

  async verify(credentials, config, ctx) {
    const res = config.list_id
      ? await request(ctx, credentials, "GET", `/lists/${encodeURIComponent(config.list_id)}`)
      : await request(ctx, credentials, "GET", "/accounts");
    return outcomeFromStatus(res.status, res.text);
  },

  async deliver(lead, credentials, config, ctx) {
    const phone = lead.phone ? e164(lead.phone) : undefined;
    const imported = await request(ctx, credentials, "POST", "/profile-import", {
      data: {
        type: "profile",
        attributes: {
          email: lead.email,
          ...(lead.firstName && { first_name: lead.firstName }),
          ...(lead.lastName && { last_name: lead.lastName }),
          ...(phone && { phone_number: phone }),
          properties: { seentics_page_url: lead.pageUrl, seentics_popup_id: lead.popupId, seentics_variant: lead.variant, ...lead.fields },
        },
      },
    });
    const first = outcomeFromStatus(imported.status, imported.text, [200, 201]);
    if (first.kind !== "ok" || !config.list_id) return first;

    if (lead.consent) {
      const sub = await request(ctx, credentials, "POST", "/profile-subscription-bulk-create-jobs", {
        data: {
          type: "profile-subscription-bulk-create-job",
          attributes: { profiles: { data: [{ type: "profile", attributes: { email: lead.email, subscriptions: { email: { marketing: { consent: "SUBSCRIBED" } } } } }] } },
          relationships: { list: { data: { type: "list", id: config.list_id } } },
        },
      });
      return outcomeFromStatus(sub.status, sub.text, [202]);
    }

    let profileId: string | undefined;
    try { profileId = (JSON.parse(imported.text) as { data?: { id?: string } }).data?.id; } catch { /* below */ }
    if (!profileId) return { kind: "failed", retryable: false, message: "Klaviyo did not return a profile id" };
    const added = await request(ctx, credentials, "POST", `/lists/${encodeURIComponent(config.list_id)}/relationships/profiles`, { data: [{ type: "profile", id: profileId }] });
    return outcomeFromStatus(added.status, added.text, [204]);
  },
};
