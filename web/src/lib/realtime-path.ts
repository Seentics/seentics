/** Normalize tracked URLs/paths for dashboard display (e.g. strip `/websites/:id` prefix). */

export function pathFromRaw(raw: string): string {
  const t = raw.trim();
  if (!t) return raw;
  try {
    if (/^https?:\/\//i.test(t) || t.startsWith('//')) {
      const u = new URL(t.startsWith('//') ? `https:${t}` : t);
      return `${u.pathname}${u.search}${u.hash}` || '/';
    }
  } catch {
    /* plain path */
  }
  return t.startsWith('/') ? t : `/${t}`;
}

export function stripWebsiteDashboardPrefix(path: string, websiteId: string): string {
  if (!websiteId) return path;
  const prefix = `/websites/${websiteId}`;
  if (path === prefix || path === `${prefix}/`) return '/';
  if (path.startsWith(`${prefix}/`)) return path.slice(prefix.length);
  return path;
}

export function shortenSessionSlugInPath(path: string): string {
  return path.replace(/(\/replays\/)(s-[a-z0-9]+)/gi, (_match, prefix: string, sid: string) => {
    const core = sid.slice(2);
    if (core.length <= 10) return `${prefix}${sid}`;
    return `${prefix}s-…${core.slice(-6)}`;
  });
}

export function displayRealtimePath(raw: string, websiteId: string, maxLen = 56): string {
  let path = pathFromRaw(raw);
  if (!path.startsWith('/')) path = `/${path}`;
  let p = stripWebsiteDashboardPrefix(path, websiteId);
  p = shortenSessionSlugInPath(p);
  if (p.length > maxLen) return `${p.slice(0, maxLen - 1)}…`;
  return p;
}
