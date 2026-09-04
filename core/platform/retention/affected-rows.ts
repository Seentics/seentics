/**
 * Row count from a `postgres` delete result.
 *
 * Every `RetentionPurge` implementation needs this — a purge reports how many rows it
 * removed, and the driver hands that back as a `count` property on the result rather
 * than as a number. Four modules had a byte-identical private copy, one per
 * `retention-purge.service.ts`.
 *
 * It lives beside the port rather than in `platform/lib` because it is not a general
 * database helper: it exists to satisfy the return shape `RetentionPurge` asks for, so
 * the next module implementing that port should find it here.
 *
 * Defensive about the shape because the value arrives as `unknown` from a tagged
 * template, and a purge that deleted nothing must report `0` rather than crash the sweep
 * for every other module behind it.
 */
export function affectedRows(result: unknown): number {
  if (
    result &&
    typeof result === "object" &&
    "count" in result &&
    typeof (result as { count: unknown }).count === "number"
  ) {
    return (result as { count: number }).count;
  }
  return 0;
}
