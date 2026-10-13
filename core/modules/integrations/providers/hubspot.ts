import { z } from "zod";
import { outcomeFromStatus } from "../lib/http";
import { lastChars } from "../lib/mask";
import type { IntegrationProvider, LeadPayload, ProviderContext } from "../interfaces";

const credentialSchema = z.object({
  access_token: z.string().trim().min(20).max(200).regex(/^[A-Za-z0-9._-]+$/, "That does not look like a private app access token"),
});
type Credentials = z.infer<typeof credentialSchema>;

const configSchema = z.object({}).passthrough().transform(() => ({}));

const API = "https://api.hubapi.com";
const headers = (c: Credentials) => ({ Authorization: `Bearer ${c.access_token}`, "Content-Type": "application/json" });

/** Standard HubSpot properties only: a custom one that does not exist would reject the whole contact. */
const properties = (lead: LeadPayload) => ({
  email: lead.email,
  ...(lead.firstName && { firstname: lead.firstName }),
  ...(lead.lastName && { lastname: lead.lastName }),
  ...(lead.phone && { phone: lead.phone }),
});

async function call(ctx: ProviderContext, c: Credentials, method: "GET" | "POST" | "PATCH", path: string, body?: unknown) {
  return ctx.request({ url: `${API}${path}`, method, headers: headers(c), body: body === undefined ? undefined : JSON.stringify(body) });
}

/**
 * HubSpot: create the contact, or update it if the email is already there.
 *
 * Updates by email (`PATCH …/contacts/{email}?idProperty=email`); a 404 means no such
 * contact, so it is created, and if that races with another creation (409) the update is
 * tried once more. This is a CRM record, not a marketing subscription, so it is sent whether
 * or not the visitor ticked the consent box — HubSpot has its own subscription controls.
 */
export const hubspot: IntegrationProvider<Credentials, Record<string, never>> = {
  id: "hubspot",
  label: "HubSpot",
  description: "Create or update HubSpot contacts from new leads.",
  docsUrl: "https://developers.hubspot.com/docs/api/crm/contacts",
  fields: [
    { kind: "credential", name: "access_token", label: "Private app access token", type: "password", placeholder: "pat-…", help: "Settings > Integrations > Private Apps. Needs the crm.objects.contacts.write scope (and read to verify).", required: true },
  ],
  credentialSchema,
  configSchema: configSchema as unknown as z.ZodType<Record<string, never>, z.ZodTypeDef, unknown>,
  hint: (c) => lastChars(c.access_token),

  async verify(credentials, _config, ctx) {
    const res = await call(ctx, credentials, "GET", "/crm/v3/objects/contacts?limit=1");
    return outcomeFromStatus(res.status, res.text);
  },

  async deliver(lead, credentials, _config, ctx) {
    const update = () => call(ctx, credentials, "PATCH", `/crm/v3/objects/contacts/${encodeURIComponent(lead.email)}?idProperty=email`, { properties: properties(lead) });

    let res = await update();
    if (res.status === 404) {
      res = await call(ctx, credentials, "POST", "/crm/v3/objects/contacts", { properties: properties(lead) });
      if (res.status === 409) res = await update();
    }
    return outcomeFromStatus(res.status, res.text);
  },
};
