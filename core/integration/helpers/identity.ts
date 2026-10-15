/**
 * Seeds for the identity, keys and external-API files: account keys minted through the
 * dashboard route, clients, and the rows the raw data API reads back.
 */
import { randomUUID } from "node:crypto";
import { expect } from "bun:test";
import { api, sql, type SeededUser } from "../harness";

export const ALL_SCOPES = ["websites:read", "websites:write", "analytics:read", "replays:read", "heatmaps:read"];

/** An account key minted the way the dashboard does it; returns the plaintext and its id. */
export async function mintAccountKey(user: SeededUser, scopes?: string[], name = "it key"): Promise<{ id: string; key: string }> {
  const res = await api("POST", "/api/v1/user/agency/api-keys", { token: user.token, body: scopes ? { name, scopes } : { name } });
  expect(res.status).toBe(201);
  return { id: res.body.data.id, key: res.body.data.key };
}

export const keyHeader = (key: string) => ({ "X-API-Key": key });

/** A client row owned by `ownerId`, straight in the table. */
export async function seedClient(ownerId: string, opts: { name?: string; status?: string; externalId?: string } = {}) {
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO clients (user_id, name, external_id, status)
    VALUES (${ownerId}::uuid, ${opts.name ?? "Client"}, ${opts.externalId ?? null}, ${opts.status ?? "active"})
    RETURNING id::text`;
  return row!.id;
}

export async function fileUnderClient(websiteId: string, clientId: string) {
  await sql`UPDATE websites SET client_id = ${clientId}::uuid WHERE id = ${websiteId}::uuid`;
}

/** Pageviews (and a custom event) for one site; returns the visitor and session ids used. */
export async function seedEvents(websiteId: string, pages: string[], opts: { at?: Date; eventType?: string } = {}) {
  const visitorId = `v-${randomUUID().slice(0, 8)}`;
  const sessionId = `s-${randomUUID().slice(0, 8)}`;
  const at = opts.at ?? new Date(Date.now() - 60_000);
  for (const page of pages) {
    await sql`INSERT INTO analytics_events (website_id, event_type, page, visitor_id, session_id, occurred_at, properties)
              VALUES (${websiteId}, ${opts.eventType ?? "pageview"}, ${page}, ${visitorId}, ${sessionId}, ${at}, '{"k":"v"}'::jsonb)`;
  }
  return { visitorId, sessionId };
}

export async function seedReplay(websiteId: string, sessionId = `s-${randomUUID().slice(0, 8)}`) {
  await sql`INSERT INTO session_replays (website_id, session_id, sequence, data, browser, device, os, country, entry_page, timestamp, pages_viewed, duration_seconds)
            VALUES (${websiteId}, ${sessionId}, 0, '[]'::jsonb, 'Chrome', 'desktop', 'macOS', 'US', '/pricing', now(), 3, 42)`;
  return sessionId;
}

export async function seedHeatmapClick(websiteId: string, pagePath: string, x = 5000, y = 2500) {
  await sql`INSERT INTO heatmap_points (website_id, page_path, event_type, device_type, x_percent, y_percent, intensity)
            VALUES (${websiteId}::uuid, ${pagePath}, 'click', 'desktop', ${x}, ${y}, 3)`;
}
