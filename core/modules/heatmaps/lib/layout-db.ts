import { sql } from "../db";

// 3-minute TTL sha256 cache — skips the regex-heavy SELECT on the common "nothing changed" path.
// Only stores sha256; callers that need full snapshot data must use getLayoutSnapshot directly.
const snapshotSha256Cache = new Map<string, { sha256: string; at: number }>();
const SNAPSHOT_TTL_MS = 3 * 60_000;

function snapshotCacheKey(websiteId: string, pagePath: string): string {
  return `${websiteId}:${pagePath}`;
}

function sweepSnapshotCache(): void {
  const cutoff = Date.now() - SNAPSHOT_TTL_MS;
  for (const [k, v] of snapshotSha256Cache) {
    if (v.at < cutoff) snapshotSha256Cache.delete(k);
  }
}

export type LayoutSnapshotRow = {
  page_path: string;
  s3_key: string;
  content_sha256: string;
  doc_width: number;
  doc_height: number;
  html_s3_key: string | null;
  updated_at: Date;
};

/**
 * Returns the cached sha256 for a (websiteId, pagePath) pair, or null on cache miss.
 * Use this in the ingest path to skip re-uploading identical screenshots without
 * fetching the full snapshot row from the DB.
 */
export function getCachedSnapshotSha256(websiteId: string, pagePath: string): string | null {
  const hit = snapshotSha256Cache.get(snapshotCacheKey(websiteId, pagePath));
  if (hit && Date.now() - hit.at < SNAPSHOT_TTL_MS) return hit.sha256;
  return null;
}

/** Same normalization as NORM_PAGE_PATH_EXPR in heatmap-db — static SQL, no user input. */
const NORM_SNAPSHOT_PATH = sql.unsafe(`
  regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(page_path,
          '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', '/:id', 'gi'),
        '/[a-z]-[a-z0-9]{16,}', '/:id', 'gi'),
      '/[a-z0-9]{24,}', '/:id', 'gi'),
    '/[0-9]{6,}', '/:id', 'g')
`);

export async function getLayoutSnapshot(
  websiteId: string,
  pagePath: string,
): Promise<LayoutSnapshotRow | null> {
  const rows = await sql`
    SELECT page_path, s3_key, content_sha256, doc_width, doc_height, html_s3_key, updated_at
    FROM heatmap_page_snapshots
    WHERE website_id = ${websiteId}::uuid
      AND (
        regexp_replace(COALESCE(NULLIF(BTRIM(page_path), ''), '/'), '/$', '')
          = regexp_replace(COALESCE(NULLIF(BTRIM(${pagePath}), ''), '/'), '/$', '')
        OR regexp_replace(${NORM_SNAPSHOT_PATH}, '/$', '')
          = regexp_replace(COALESCE(NULLIF(BTRIM(${pagePath}), ''), '/'), '/$', '')
      )
    ORDER BY updated_at DESC
    LIMIT 1
  `;
  const r = rows[0] as Record<string, unknown> | undefined;
  if (!r) return null;
  const row: LayoutSnapshotRow = {
    page_path: String(r.page_path),
    s3_key: String(r.s3_key),
    content_sha256: String(r.content_sha256),
    doc_width: Number(r.doc_width),
    doc_height: Number(r.doc_height),
    html_s3_key: r.html_s3_key != null ? String(r.html_s3_key) : null,
    updated_at: r.updated_at as Date,
  };
  if (Math.random() < 0.05) sweepSnapshotCache();
  snapshotSha256Cache.set(snapshotCacheKey(websiteId, pagePath), { sha256: row.content_sha256, at: Date.now() });
  return row;
}

export async function upsertLayoutSnapshot(
  websiteId: string,
  pagePath: string,
  s3Key: string,
  sha256: string,
  docW: number,
  docH: number,
): Promise<void> {
  await sql`
    INSERT INTO heatmap_page_snapshots (website_id, page_path, s3_key, content_sha256, doc_width, doc_height, updated_at)
    VALUES (${websiteId}::uuid, ${pagePath}, ${s3Key}, ${sha256}, ${docW}, ${docH}, NOW())
    ON CONFLICT (website_id, page_path) DO UPDATE SET
      s3_key = EXCLUDED.s3_key,
      content_sha256 = EXCLUDED.content_sha256,
      -- A DOM HTML snapshot (captured at the visitor's real viewport) is what the
      -- preview renders and is authoritative for dimensions. Don't let a JPEG/Playwright
      -- capture (fixed 1920 viewport) clobber those dims, or the iframe renders the
      -- DOM snapshot at the wrong width and every dot misaligns.
      doc_width = CASE WHEN heatmap_page_snapshots.html_s3_key IS NOT NULL
                       THEN heatmap_page_snapshots.doc_width ELSE EXCLUDED.doc_width END,
      doc_height = CASE WHEN heatmap_page_snapshots.html_s3_key IS NOT NULL
                        THEN heatmap_page_snapshots.doc_height ELSE EXCLUDED.doc_height END,
      updated_at = NOW()
  `;
  if (Math.random() < 0.05) sweepSnapshotCache();
  snapshotSha256Cache.set(snapshotCacheKey(websiteId, pagePath), { sha256, at: Date.now() });
}

/**
 * Upsert a DOM HTML snapshot for a heatmap page.
 * Creates the row if absent (using placeholder JPEG key values), or sets html_s3_key on existing row.
 */
export async function upsertLayoutHtmlSnapshot(
  websiteId: string,
  pagePath: string,
  htmlS3Key: string,
  sha256: string,
  docW: number,
  docH: number,
): Promise<void> {
  await sql`
    INSERT INTO heatmap_page_snapshots
      (website_id, page_path, s3_key, content_sha256, doc_width, doc_height, html_s3_key, updated_at)
    VALUES
      (${websiteId}::uuid, ${pagePath}, '', ${sha256}, ${docW}, ${docH}, ${htmlS3Key}, NOW())
    ON CONFLICT (website_id, page_path) DO UPDATE SET
      html_s3_key    = EXCLUDED.html_s3_key,
      content_sha256 = EXCLUDED.content_sha256,
      doc_width      = EXCLUDED.doc_width,
      doc_height     = EXCLUDED.doc_height,
      updated_at     = NOW()
  `;
  snapshotSha256Cache.set(snapshotCacheKey(websiteId, pagePath), { sha256, at: Date.now() });
}
