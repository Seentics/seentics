import { sql } from "../../../db";

/**
 * SQL mirror of `lib/paths.normalizeHeatmapPagePath`.
 *
 * Rows written before a normalisation rule existed still carry the raw path, so a query
 * for `/orders/:id` has to match both forms. Shared by the read and delete paths, which
 * is why it is here rather than duplicated in either.
 *
 * Static SQL, no interpolation — `sql.unsafe` is safe precisely because nothing
 * caller-supplied reaches it.
 */
export const NORM_PAGE_PATH_EXPR = sql.unsafe(`
  regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(page_path,
          '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', '/:id', 'gi'),
        '/[a-z]-[a-z0-9]{16,}', '/:id', 'gi'),
      '/[a-z0-9]{24,}', '/:id', 'gi'),
    '/[0-9]{6,}', '/:id', 'g')
`);
