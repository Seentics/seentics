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
