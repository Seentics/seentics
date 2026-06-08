/** Path only from full URL (matches Go `url.Parse` path for tracker URLs). */
export function extractPath(rawURL: string): string {
  if (!rawURL?.trim()) return "/";
  try {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(rawURL) || rawURL.startsWith("//")) {
      const u = new URL(rawURL.startsWith("//") ? `https:${rawURL}` : rawURL);
      return u.pathname && u.pathname !== "" ? u.pathname : "/";
    }
    const pathPart = rawURL.split(/[?#]/)[0] ?? "/";
    if (!pathPart.startsWith("/")) return `/${pathPart}`;
    return pathPart || "/";
  } catch {
    return "/";
  }
}

/**
 * Segments that look like opaque IDs — UUIDs, session slugs (s-xxx),
 * long base36/hex strings (24+ chars), and long numeric IDs (6+ digits).
 * Replaced with `:id` so dynamic-route pages collapse to one heatmap entry.
 */
const DYNAMIC_SEGMENT_RE =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[a-z]-[a-z0-9]{16,}|[a-z0-9]{24,}|\d{6,})$/i;

/** Canonical path for DB matching (matches Go `NormalizeHeatmapPagePath`). */
export function normalizeHeatmapPagePath(path: string): string {
  let p = (path ?? "").trim();
  if (!p) return "/";
  const q = p.search(/[?#]/);
  if (q >= 0) p = p.slice(0, q);
  if (!p.startsWith("/")) p = `/${p}`;
  p = p.replace(/\/+$/, "");
  // Collapse dynamic-ID segments so /replays/s-abc123 and /replays/s-xyz789
  // both become /replays/:id and share one heatmap entry.
  p = p
    .split("/")
    .map((seg) => (DYNAMIC_SEGMENT_RE.test(seg) ? ":id" : seg))
    .join("/");
  return p || "/";
}
