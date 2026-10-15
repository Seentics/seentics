import { randomUUID } from "node:crypto";
import { env } from "../../config";
import { createHttpApp } from "../../app/http-app";
import { api, application, sql } from "../harness";

/** A popup automation stored directly, so lead tests do not depend on the automations API. */
export async function seedPopup(
  websiteId: string,
  ownerId: string,
  action: Record<string, unknown> = { type: "show_modal", form: { fields: ["email"] } },
): Promise<string> {
  const definition = {
    graph: {
      nodes: [
        { id: "t", kind: "trigger", trigger: { type: "page_view" } },
        { id: "a", kind: "action", action },
      ],
      edges: [{ from: "t", to: "a" }],
    },
  };
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO automations (website_id, user_id, name, definition)
    VALUES (${websiteId}::uuid, ${ownerId}::uuid, 'Popup', ${JSON.stringify(definition)}::jsonb)
    RETURNING id::text`;
  return row!.id;
}

/** A wheel whose only winnable slice is known, so the prize is deterministic. */
export const wheelAction = {
  type: "show_modal",
  layout: "spin_wheel",
  form: { fields: ["email"] },
  wheel: { segments: [{ label: "10% off", weight: 1, coupon_code: "TEN" }, { label: "Nothing", weight: 0, coupon_code: "" }] },
};

/** An enabled integration destination; its credentials are never read by these tests. */
export async function seedConnection(websiteId: string, opts: { enabled?: boolean } = {}): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO integration_connections (website_id, provider, name, credentials, enabled)
    VALUES (${websiteId}::uuid, 'zapier', 'Zap', 'ciphertext', ${opts.enabled ?? true})
    RETURNING id::text`;
  return row!.id;
}

/** A stored submission, bypassing the public endpoint (for dashboard-side tests). */
export async function seedSubmission(
  websiteId: string,
  automationId: string | null,
  values: { email?: string; name?: string; fields?: Record<string, unknown>; variant?: string | null; createdAt?: Date } = {},
): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO form_submissions (website_id, automation_id, email, name, fields, variant, created_at)
    VALUES (${websiteId}::uuid, ${automationId}::uuid, ${values.email ?? `${randomUUID().slice(0, 6)}@lead.test`},
            ${values.name ?? ""}, ${JSON.stringify(values.fields ?? {})}::jsonb, ${values.variant ?? null},
            ${values.createdAt ?? new Date()})
    RETURNING id::text`;
  return row!.id;
}

/** POST a lead the way the tracker does: anonymous, JSON. */
export function submit(body: unknown, headers: Record<string, string> = {}) {
  return api("POST", "/api/v1/tracker/leads", { body, headers });
}

let raw: ReturnType<typeof createHttpApp> | null = null;
/** The same composed app, for requests the harness cannot express (streamed bodies). */
export function rawApp() {
  return (raw ??= createHttpApp(env(), application(), () => true));
}
