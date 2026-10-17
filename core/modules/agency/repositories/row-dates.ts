/**
 * Raw queries on the shared client return timestamps as strings — `drizzle(sql)` swaps the
 * client's date parsers for pass-throughs (see `db/index.ts`) — so rows are converted here.
 */
export function toDate(v: unknown): Date {
  return v instanceof Date ? v : new Date(String(v));
}

export function toDateOrNull(v: unknown): Date | null {
  return v == null ? null : toDate(v);
}
