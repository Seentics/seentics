/** Shared fixtures for the automations integration files. */
import { randomUUID } from "node:crypto";
import { api, sql, type SeededWebsite } from "../harness";

/** A browser, so the crawler filter lets the request through. */
export const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";
export const CRAWLER_UA = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

/** The headers a page on the site sends. */
export function pageHeaders(site: SeededWebsite, ua = BROWSER_UA): Record<string, string> {
  return { Origin: `https://${site.domain}`, "User-Agent": ua };
}

/** A one-node graph around one action. */
export function graphOf(action: Record<string, unknown>) {
  return { entry: "a", nodes: [{ id: "a", kind: "action", action }], edges: [] as unknown[] };
}

/** The smallest definition the schema accepts, with overrides. */
export function definition(over: Record<string, unknown> = {}) {
  return {
    triggers: [{ type: "exit_intent" }],
    graph: graphOf({ type: "show_banner", custom_html: "<p>Hi</p>" }),
    ...over,
  };
}

/** Create through the API; fails the test if the API refuses. */
export async function createAutomation(token: string, websiteId: string, body: Record<string, unknown> = {}) {
  const res = await api("POST", `/api/v1/automations/${websiteId}`, {
    token,
    body: { name: "Exit banner", definition: definition(), ...body },
  });
  if (res.status !== 201) throw new Error(`create failed: ${res.status} ${res.text}`);
  return res.body.data as { id: string; name: string; isActive: boolean; definition: any };
}

/** Write an automation straight to the table — for definitions the API would (rightly) refuse. */
export async function insertAutomation(websiteId: string, userId: string, def: unknown, active = true): Promise<string> {
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO automations (website_id, user_id, name, definition, is_active)
    VALUES (${websiteId}::uuid, ${userId}::uuid, 'raw', ${JSON.stringify(def)}::jsonb, ${active})
    RETURNING id::text`;
  return row!.id;
}

/** A visitor on the site firing one trigger. */
export function evaluate(
  site: SeededWebsite,
  trigger: Record<string, unknown>,
  opts: { anonymousId?: string; sessionId?: string; ua?: string; context?: Record<string, unknown> } = {},
) {
  return api("POST", "/api/v1/tracker/automations/evaluate", {
    headers: pageHeaders(site, opts.ua),
    body: {
      website_id: site.trackingId,
      anonymous_id: opts.anonymousId ?? `v-${randomUUID().slice(0, 8)}`,
      session_id: opts.sessionId ?? `s-${randomUUID().slice(0, 8)}`,
      trigger,
      context: opts.context ?? {},
    },
  });
}

/** Poll until `probe` returns something truthy, for work the app does fire-and-forget. */
export async function eventually<T>(probe: () => Promise<T>, timeoutMs = 3000): Promise<T> {
  const until = Date.now() + timeoutMs;
  for (;;) {
    const v = await probe();
    if (v || Date.now() > until) return v;
    await new Promise((r) => setTimeout(r, 25));
  }
}
