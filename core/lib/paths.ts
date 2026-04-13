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

/** Canonical path for DB matching (matches Go `NormalizeHeatmapPagePath`). */
export function normalizeHeatmapPagePath(path: string): string {
  let p = (path ?? "").trim();
  if (!p) return "/";
  const q = p.search(/[?#]/);
  if (q >= 0) p = p.slice(0, q);
  if (!p.startsWith("/")) p = `/${p}`;
  p = p.replace(/\/+$/, "");
  return p || "/";
}
