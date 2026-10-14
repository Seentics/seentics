/**
 * The stylesheet archive's contracts.
 *
 * Recordings and heatmap snapshots store `<link rel="stylesheet">` URLs, not the CSS, and
 * a site's hashed CSS files disappear on its next deploy. The archive keeps a copy of each
 * stylesheet a recording or snapshot links to, and serves it back to the player. Owned by
 * the recordings module (`replay_stylesheets`); heatmaps reach it through these ports.
 */

/** Recording stylesheet URLs a page snapshot links to. */
export interface StylesheetDiscovery {
  /**
   * Queue every stylesheet a stored DOM snapshot links to, resolved against its `<base>`
   * or `pageUrl`. Best-effort and bounded: never throws, never fetches.
   */
  discoverFromHtml(websiteId: string, html: string, pageUrl: string): Promise<void>;
}

/** The capability a browser presents to read a website's archived stylesheets. */
export interface StylesheetAccess {
  /**
   * A token for `GET /embed/:websiteId/stylesheet?url=…&st=<token>`, valid for a day or
   * more and stable within a UTC day, so the browser can cache the stylesheet URLs. Hand it
   * out only from reads already authorized for `websiteId`.
   */
  accessToken(websiteId: string): { token: string; expiresAt: string };
}

/** What the stylesheet endpoint answers. */
export type StylesheetServeResult =
  | { kind: "css"; body: string }
  /** No archived copy (yet): the original, which is queued for archiving. */
  | { kind: "redirect"; location: string }
  | { kind: "forbidden" }
  | { kind: "not_found" };

export interface StylesheetServing {
  /**
   * The archived copy of `url` for `websiteId`, when `token` was issued for that site.
   * Never reads another site's rows or objects: the token, the row and the object key are
   * all scoped to `websiteId`.
   */
  serve(websiteId: string, url: string, token: string | undefined): Promise<StylesheetServeResult>;
}

/** Counts from one scheduled run, for the job log. */
export type StylesheetArchiveRunStats = {
  claimed: number;
  stored: number;
  failed: number;
  retried: number;
  backfillSessions: number;
  backfillQueued: number;
};

/** The scheduled fetch-and-backfill job. */
export interface StylesheetArchiveJobs {
  runOnce(): Promise<StylesheetArchiveRunStats>;
}

/** Everything the module offers about archived stylesheets. */
export type StylesheetArchive = StylesheetDiscovery & StylesheetAccess & StylesheetServing & StylesheetArchiveJobs;
