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
    const rows = await sql<{ id: string; website_id: string }[]>`
      SELECT id::text AS id, website_id FROM websites
    `;
    return rows.map((r) => ({ websiteId: r.id }));
  }
}
