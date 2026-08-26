/**
 * Request validation for the heatmaps HTTP surface.
 *
 * The two screenshot endpoints have no schema here on purpose: they read a wide
 * bag of optional capture options with per-field numeric fallbacks, and rejecting
 * a request because `viewport_width` arrived as `"1920px"` would fail a capture
 * that a default handles fine. Their coercion lives in the route.
 *
 * `routes.ts` imports from `./validators/heatmap.schema` rather than this barrel:
 * re-exporting a schema with defaults widens its inferred output type and the
 * handlers silently lose their parameter types.
 */
export {
  heatmapBulkDeleteSchema,
  heatmapDataQuerySchema,
  heatmapSnapshotQuerySchema,
} from "./heatmap.schema";
