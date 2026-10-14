import { createHmac } from "node:crypto";
import { z } from "zod";
import { outcomeFromStatus } from "../lib/http";
import { lastChars } from "../lib/mask";
import type { IntegrationProvider, LeadPayload } from "../interfaces";

const credentialSchema = z.object({
  /** Zapier's "Catch Hook" URL. It is the secret: anyone holding it can trigger the Zap. */
  webhook_url: z.string().trim().url().max(2048).refine((u) => u.startsWith("https://"), "Use the https URL from the Catch Hook trigger"),
  /** Optional: when set, every request is signed so the receiver can verify it came from us. */
  signing_secret: z.string().trim().max(200).optional().transform((s) => s || undefined),
});
type Credentials = z.infer<typeof credentialSchema>;

const configSchema = z.object({}).passthrough().transform(() => ({}));

/** The JSON a Zap (or any webhook receiver) gets. Stable: Zaps map fields by name. */
export function webhookBody(lead: LeadPayload) {
  return {
    event: lead.test ? "lead.test" : "lead.captured",
    test: lead.test === true,
    submitted_at: lead.submittedAt,
    submission_id: lead.submissionId,
    email: lead.email,
    name: lead.name,
    first_name: lead.firstName,
    last_name: lead.lastName,
    phone: lead.phone,
    consent: lead.consent,
    fields: lead.fields,
    prize: lead.prize,
    source: { popup_id: lead.popupId, variant: lead.variant, page_url: lead.pageUrl, referrer: lead.referrer },
  };
}

/**
 * Zapier, and any other service that accepts a JSON webhook.
 *
 * The URL is user-supplied, so it is the one outbound destination here that goes through the
 * SSRF guard before every request. A signature header is added when the owner set a secret:
 * `X-Seentics-Signature: sha256=<hex hmac of the body>`.
 */
export const zapier: IntegrationProvider<Credentials, Record<string, never>> = {
  id: "zapier",
  label: "Zapier / Webhook",
  description: "Send every new submission to a Zapier Catch Hook, or to any HTTPS endpoint that accepts JSON.",
  docsUrl: "https://help.zapier.com/hc/en-us/articles/8496083355661",
  fields: [
    { kind: "credential", name: "webhook_url", label: "Webhook URL", type: "password", placeholder: "https://hooks.zapier.com/hooks/catch/…", help: "Copy it from your Zap's Catch Hook trigger. Treat it like a password.", required: true },
    { kind: "credential", name: "signing_secret", label: "Signing secret (optional)", type: "password", help: "If set, requests carry an X-Seentics-Signature HMAC so you can verify them.", required: false },
  ],
  credentialSchema,
  configSchema: configSchema as unknown as z.ZodType<Record<string, never>, z.ZodTypeDef, unknown>,
  hint: (c) => lastChars(new URL(c.webhook_url).pathname.replace(/\/$/, "")),

  async verify(credentials, config, ctx) {
    return this.deliver({ ...SAMPLE, test: true }, credentials, config, ctx);
  },

  async deliver(lead, credentials, _config, ctx, delivery) {
    await ctx.assertPublicUrl(credentials.webhook_url);
    const body = JSON.stringify(webhookBody(lead));
    // Delivery is at-least-once (a retry after a lost reply sends the lead again), so every
    // request names its submission: receivers de-duplicate on `Idempotency-Key`.
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "User-Agent": "Seentics-Webhook/1.0",
      "Idempotency-Key": lead.submissionId,
      ...(delivery && { "X-Seentics-Delivery": delivery.id }),
    };
    if (credentials.signing_secret) {
      headers["X-Seentics-Signature"] = `sha256=${createHmac("sha256", credentials.signing_secret).update(body).digest("hex")}`;
    }
    const res = await ctx.request({ url: credentials.webhook_url, method: "POST", headers, body });
    return outcomeFromStatus(res.status, res.text);
  },
};

const SAMPLE: LeadPayload = {
  submissionId: "00000000-0000-0000-0000-000000000000",
  email: "seentics-test@example.com",
  name: "Seentics Test",
  firstName: "Seentics",
  lastName: "Test",
  phone: "",
  consent: true,
  fields: {},
  prize: null,
  popupId: null,
  variant: null,
  pageUrl: "https://example.com/",
  referrer: "",
  submittedAt: new Date(0).toISOString(),
  test: true,
};
