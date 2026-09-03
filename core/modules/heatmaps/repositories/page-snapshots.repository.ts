import { sql } from "../../../db";

/**
 * The stale-snapshot scan over `heatmap_page_snapshots`.
 *
 * Separated from the point repositories because it is a different table with a different
 * caller: the scheduled re-capture, not the dashboard or the ingest engine.
 */

/**
 * Pages whose stored snapshot has gone stale, for the scheduled re-capture.
 *
 * `DISTINCT ON` because a page can have both a JPEG and an HTML snapshot row
 * shape and one re-capture refreshes both. Rows with no stored artefact at all are
 * excluded — there is nothing to refresh, and the dashboard already triggers a
 * first capture on its own miss.
 *
 * `websiteId` here comes back out of the table, so callers must resolve it to a
 * `website_id` before touching S3 or `analytics_events`.
 */
export async function listStalePageSnapshots(
  staleBefore: Date,
  limit: number,
): Promise<{ websiteId: string; pagePath: string }[]> {
  const rows = await sql<{ website_id: string; page_path: string }[]>`
    SELECT DISTINCT ON (website_id, page_path) website_id::text AS website_id, page_path
    FROM heatmap_page_snapshots
    WHERE updated_at < ${staleBefore}
      AND (s3_key <> '' OR html_s3_key IS NOT NULL)
    LIMIT ${limit}
  `;
  return rows.map((r) => ({ websiteId: r.website_id, pagePath: r.page_path }));
}
