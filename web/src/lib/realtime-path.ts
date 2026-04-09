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

export function activityReferrerLabel(raw: string, websiteId?: string): string {
  if (!raw) return '';
  try {
    const url = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      let path = `${url.pathname}${url.search || ''}` || '/';
      if (websiteId) {
        path = stripWebsiteDashboardPrefix(path, websiteId);
        path = shortenSessionSlugInPath(path);
      }
      return path.length > 52 ? `${path.slice(0, 51)}…` : path;
    }
    return url.hostname.replace(/^www\./, '');
  } catch {
    return raw.length > 24 ? `${raw.slice(0, 21)}…` : raw;
  }
}
