import { createHash } from "node:crypto";
import { z } from "zod";
import { outcomeFromStatus } from "../lib/http";
import { lastChars } from "../lib/mask";
import type { IntegrationProvider } from "../interfaces";

/** `<key>-<dc>`: the data centre is the part after the last hyphen, e.g. `us21`. */
const API_KEY = /^[0-9a-f]{20,40}-[a-z]{2,3}\d{1,3}$/i;

const credentialSchema = z.object({
  api_key: z.string().trim().regex(API_KEY, "Paste the full API key, including the part after the hyphen (for example …-us21)"),
});
type Credentials = z.infer<typeof credentialSchema>;

const configSchema = z.object({
  audience_id: z.string().trim().regex(/^[0-9a-z]{6,20}$/i, "Enter your Audience ID (Audience > Settings > Audience name and defaults)"),
  /** Ask new subscribers to confirm by email first. */
  double_opt_in: z.boolean().default(false),
});
type Config = z.infer<typeof configSchema>;

const dc = (c: Credentials) => c.api_key.slice(c.api_key.lastIndexOf("-") + 1).toLowerCase();
const base = (c: Credentials) => `https://${dc(c)}.api.mailchimp.com/3.0`;
const auth = (c: Credentials) => ({
  // Mailchimp ignores the user name; the key is the password.
  Authorization: `Basic ${Buffer.from(`seentics:${c.api_key}`).toString("base64")}`,
  "Content-Type": "application/json",
});

/**
 * Mailchimp: add or update the lead as an audience member.
 *
 * Only leads who ticked the consent checkbox are sent. Mailchimp's rules (and the law in many
 * places) treat a list subscription as marketing consent, and this form is the only place we
 * learn it, so a lead without it is *skipped*, not subscribed. It stays in the Leads inbox and
 * in the CSV export. `PUT …/members/{md5(email)}` makes the call idempotent: a repeat
 * submission updates the member rather than failing.
 */
export const mailchimp: IntegrationProvider<Credentials, Config> = {
  id: "mailchimp",
  label: "Mailchimp",
  description: "Add leads who gave consent to a Mailchimp audience.",
  docsUrl: "https://mailchimp.com/developer/marketing/api/list-members/add-or-update-list-member/",
  fields: [
    { kind: "credential", name: "api_key", label: "API key", type: "password", placeholder: "xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx-us21", help: "Account > Extras > API keys.", required: true },
    { kind: "config", name: "audience_id", label: "Audience ID", type: "text", help: "Audience > Settings > Audience name and defaults.", required: true },
    { kind: "config", name: "double_opt_in", label: "Require email confirmation (double opt-in)", type: "checkbox", required: false },
  ],
  credentialSchema,
  configSchema,
  hint: (c) => lastChars(c.api_key.slice(0, c.api_key.lastIndexOf("-"))),

  async verify(credentials, config, ctx) {
    const res = await ctx.request({ url: `${base(credentials)}/lists/${encodeURIComponent(config.audience_id)}?fields=id,name`, method: "GET", headers: auth(credentials) });
    return outcomeFromStatus(res.status, res.text);
  },

  async deliver(lead, credentials, config, ctx) {
    if (!lead.consent) return { kind: "skipped", reason: "No marketing consent given" };
    const hash = createHash("md5").update(lead.email.toLowerCase()).digest("hex");
    const res = await ctx.request({
      url: `${base(credentials)}/lists/${encodeURIComponent(config.audience_id)}/members/${hash}`,
      method: "PUT",
      headers: auth(credentials),
      body: JSON.stringify({
        email_address: lead.email,
        status_if_new: config.double_opt_in ? "pending" : "subscribed",
        merge_fields: { ...(lead.firstName && { FNAME: lead.firstName }), ...(lead.lastName && { LNAME: lead.lastName }) },
      }),
    });
    return outcomeFromStatus(res.status, res.text);
  },
};
