import { sql } from "../../../db";
import type { SnapshotDeviceBucket } from "../lib/device";

/** Record an immutable DOM/layout variant while canonical reads remain compatible. */
export async function upsertLayoutVersion(
  websiteId: string,
  pagePath: string,
  device: SnapshotDeviceBucket,
  domFingerprint: string,
  htmlS3Key: string,
  sha256: string,
  docW: number,
  docH: number,
): Promise<void> {
  if (!domFingerprint) return;
  await sql`
    INSERT INTO heatmap_page_versions
      (website_id, page_path, device_type, dom_fingerprint, viewport_width,
       viewport_height, html_s3_key, content_sha256, event_count, first_seen_at, last_seen_at)
    VALUES
      (${websiteId}::uuid, ${pagePath}, ${device}, ${domFingerprint}, ${docW},
       ${docH}, ${htmlS3Key}, ${sha256},
       (SELECT COALESCE(SUM(intensity), 0)::int FROM heatmap_points
        WHERE website_id = ${websiteId}::uuid AND page_path = ${pagePath}
          AND device_type = ${device} AND page_version = ${domFingerprint}),
       NOW(), NOW())
    ON CONFLICT (website_id, page_path, device_type, dom_fingerprint) DO UPDATE SET
      html_s3_key = EXCLUDED.html_s3_key,
      content_sha256 = EXCLUDED.content_sha256,
      viewport_width = EXCLUDED.viewport_width,
      viewport_height = EXCLUDED.viewport_height,
      event_count = EXCLUDED.event_count,
      last_seen_at = NOW()
  `;
}

/**
 * Whether a fingerprint is already recorded for this page, and how many versions the site
 * has started recording in the last day — the two numbers `storeDomSnapshot` budgets on.
 *
 * Versions arrive from an unauthenticated endpoint and each new one is an object in storage
 * and a row here, so a client inventing fingerprints could otherwise add both forever.
 */
export async function layoutVersionBudget(
  websiteId: string,
  pagePath: string,
  device: SnapshotDeviceBucket,
  domFingerprint: string,
): Promise<{ known: boolean; newToday: number }> {
  const [row] = await sql<{ known: boolean; new_today: number }[]>`
    SELECT
      EXISTS (
        SELECT 1 FROM heatmap_page_versions
        WHERE website_id = ${websiteId}::uuid AND page_path = ${pagePath}
          AND device_type = ${device} AND dom_fingerprint = ${domFingerprint}
      ) AS known,
      (SELECT count(*)::int FROM heatmap_page_versions
        WHERE website_id = ${websiteId}::uuid AND first_seen_at > NOW() - interval '1 day') AS new_today
  `;
  return { known: row?.known ?? false, newToday: row?.new_today ?? 0 };
}

/**
 * Keep the `keep` most recently seen versions of one page and device, deleting the rest.
 *
 * Returns the html keys of deleted versions that nothing else still points at — neither the
 * canonical snapshot nor a surviving version (two fingerprints with identical html share a
 * content-addressed key) — so the caller can delete exactly those objects. The surviving-version
 * check excludes `doomed` explicitly: every part of one statement reads the table as it was
 * before the DELETE, so without that each deleted row would count as still referencing itself.
 */
export async function pruneLayoutVersions(
  websiteId: string,
  pagePath: string,
  device: SnapshotDeviceBucket,
  keep: number,
): Promise<string[]> {
  const rows = await sql<{ key: string }[]>`
    WITH doomed AS (
      SELECT id FROM heatmap_page_versions
      WHERE website_id = ${websiteId}::uuid AND page_path = ${pagePath} AND device_type = ${device}
      ORDER BY last_seen_at DESC
      OFFSET ${keep}
    ), gone AS (
      DELETE FROM heatmap_page_versions v USING doomed d WHERE v.id = d.id
      RETURNING v.html_s3_key
    )
    SELECT DISTINCT g.html_s3_key AS key FROM gone g
    WHERE g.html_s3_key IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM heatmap_page_snapshots s
        WHERE s.website_id = ${websiteId}::uuid AND s.html_s3_key = g.html_s3_key
      )
      AND NOT EXISTS (
        SELECT 1 FROM heatmap_page_versions v2
        WHERE v2.website_id = ${websiteId}::uuid AND v2.html_s3_key = g.html_s3_key
          AND v2.id NOT IN (SELECT id FROM doomed)
      )
  `;
  return rows.map((r) => r.key);
}
