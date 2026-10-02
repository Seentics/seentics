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
