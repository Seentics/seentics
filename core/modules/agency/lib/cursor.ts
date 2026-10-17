import type { CursorPosition } from "../../websites/interfaces";

/**
 * List cursors: base64url of `<created_at ISO>,<id>` — the last row of the page before.
 * Opaque to callers; they pass `page.next_cursor` back as `?cursor=` and nothing else.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function encodeCursor(row: { createdAt: Date; id: string }): string {
  return Buffer.from(`${row.createdAt.toISOString()},${row.id}`, "utf8").toString("base64url");
}

/** `null` for anything that is not a cursor this API issued. */
export function decodeCursor(cursor: string): CursorPosition | null {
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(cursor)) return null;
  const [at, id, extra] = Buffer.from(cursor, "base64url").toString("utf8").split(",");
  if (extra !== undefined || !at || !id || !UUID_RE.test(id)) return null;
  const createdAt = new Date(at);
  return Number.isNaN(createdAt.getTime()) || createdAt.toISOString() !== at ? null : { createdAt, id };
}

/** The `next_cursor` for a page: its last row, while there is more. */
export function nextCursor<T extends { createdAt: Date; id: string }>(items: T[], hasMore: boolean): string | null {
  const last = items[items.length - 1];
  return hasMore && last ? encodeCursor(last) : null;
}
