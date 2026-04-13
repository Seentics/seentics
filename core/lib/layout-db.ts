import { sql } from "../db";

export type LayoutSnapshotRow = {
  page_path: string;
  s3_key: string;
  content_sha256: string;
  doc_width: number;
  doc_height: number;
  updated_at: Date;
};

export async function getLayoutSnapshot(
  websiteId: string,
  pagePath: string,
): Promise<LayoutSnapshotRow | null> {
  const rows = await sql`
    SELECT page_path, s3_key, content_sha256, doc_width, doc_height, updated_at
    FROM heatmap_page_snapshots
    WHERE website_id = ${websiteId}::uuid
      AND regexp_replace(COALESCE(NULLIF(BTRIM(page_path), ''), '/'), '/$', '') =
          regexp_replace(COALESCE(NULLIF(BTRIM(${pagePath}), ''), '/'), '/$', '')
    LIMIT 1
  `;
  const r = rows[0] as Record<string, unknown> | undefined;
  if (!r) return null;
  return {
    page_path: String(r.page_path),
    s3_key: String(r.s3_key),
    content_sha256: String(r.content_sha256),
    doc_width: Number(r.doc_width),
    doc_height: Number(r.doc_height),
    updated_at: r.updated_at as Date,
  };
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
      doc_width = EXCLUDED.doc_width,
      doc_height = EXCLUDED.doc_height,
      updated_at = NOW()
  `;
}
