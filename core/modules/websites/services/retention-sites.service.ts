import { sql } from "../../../db";
import type { RetentionSiteSource, RetentionTarget } from "../../../platform/retention";

/**
 * Backs `RetentionSiteSource`.
 *
 * Deliberately not `WebsiteQuery.listOwnedBy`: retention has no user to scope by, and
 * loading the full `Website` for every site in the deployment to read two columns is
 * the kind of thing that only shows up once the table is large.
 */
export class WebsiteRetentionSiteSource implements RetentionSiteSource {
  async listAllSites(): Promise<readonly RetentionTarget[]> {
    // Only `id`: the second identifier this also selected (`website_id`) is gone from
    // the table, and asking for it failed the whole nightly sweep before any purge ran.
    const rows = await sql<{ id: string }[]>`
      SELECT id::text AS id FROM websites
    `;
    return rows.map((r) => ({ websiteId: r.id }));
  }
}

/**
 * Sites worth a daily AI insight: active, with analytics events in the last `days` UTC days.
 *
 * Read from `analytics_event_counts` (one row per site and day, kept by ingest), not from
 * `analytics_events`: at most `days + 1` small rows per site rather than a scan of raw events.
 * Busiest first, then by id, so the order is the same from one run to the next and a cap
 * drops the quietest sites, not an arbitrary set. Asks for one row past `limit` so the
 * caller can tell (and log) that the cap cut the list short.
 *
 * Not gated on plan: entitlements are resolved by the gateway's billing, which core cannot
 * reach.
 */
export async function listInsightCandidateSites(
  opts: { days: number; limit: number },
): Promise<{ websiteIds: string[]; truncated: boolean }> {
  const days = Math.max(1, Math.trunc(opts.days) || 7);
  const limit = Math.max(1, Math.trunc(opts.limit) || 1);
  const rows = await sql<{ id: string }[]>`
    SELECT w.id::text AS id
    FROM analytics_event_counts c
    JOIN websites w ON w.id::text = c.website_id
    WHERE c.day >= ((now() AT TIME ZONE 'UTC')::date - ${days}::int)
      AND w.is_active
    GROUP BY w.id
    HAVING sum(c.events) > 0
    ORDER BY sum(c.events) DESC, w.id
    LIMIT ${limit + 1}
  `;
  return { websiteIds: rows.slice(0, limit).map((r) => r.id), truncated: rows.length > limit };
}

/**
 * Who a site's weekly digest goes to, and what to call the site: the owner, then every member
 * oldest first. One query; `null` when the site is gone or inactive.
 */
export async function getDigestSite(
  websiteId: string,
): Promise<{ id: string; name: string; domain: string; userIds: string[] } | null> {
  const [row] = await sql<{ id: string; name: string; url: string; owner: string; members: string[] | null }[]>`
    SELECT w.id::text AS id, w.name, w.url, w.user_id::text AS owner,
           array_agg(m.user_id::text ORDER BY m.created_at) FILTER (WHERE m.user_id IS NOT NULL) AS members
    FROM websites w
    LEFT JOIN website_members m ON m.website_id = w.id
    WHERE w.id = ${websiteId}::uuid AND w.is_active
    GROUP BY w.id
  `;
  if (!row) return null;
  return { id: row.id, name: row.name, domain: row.url, userIds: [...new Set([row.owner, ...(row.members ?? [])])] };
}
