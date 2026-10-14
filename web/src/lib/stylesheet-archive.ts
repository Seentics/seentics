import { getApiUrl } from '@/lib/config';

/**
 * Pointing recorded stylesheet links at Seentics' archived copies.
 *
 * Recordings and heatmap snapshots store `<link rel="stylesheet" href="https://site/…/<hash>.css">`,
 * not the CSS. Loading that URL at replay time fails as soon as the site deploys again (hashed
 * files are deleted), and the replay renders as unstyled HTML. Core keeps a copy of each one;
 * these helpers rewrite the links to `GET /embed/:websiteId/stylesheet?url=…&st=…`, which serves
 * the copy — or redirects to the original while there is none yet, so nothing gets worse.
 *
 * `st` is the site-scoped token core returns with the recording or the page layout. It goes in
 * the URL because a `<link>` inside the player's iframe or a sandboxed snapshot carries no
 * Authorization header, and in an embed no cookie either.
 */

export type StylesheetArchiveContext = { websiteId: string; token: string };

/** The archive endpoint, absolute: a snapshot's `<base href>` must not re-point it at the site. */
function archiveEndpoint(websiteId: string): string {
  const path = getApiUrl(`/embed/${encodeURIComponent(websiteId)}/stylesheet`);
  if (typeof window === 'undefined') return path;
  try {
    return new URL(path, window.location.href).toString();
  } catch {
    return path;
  }
}

/** A function turning a stylesheet href into its archived URL; `null` leaves it alone. */
export type StylesheetHrefRewriter = (href: string, base?: string) => string | null;

export function stylesheetHrefRewriter(ctx: StylesheetArchiveContext): StylesheetHrefRewriter {
  const endpoint = archiveEndpoint(ctx.websiteId);
  return (href, base) => {
    if (!href || href.startsWith(endpoint)) return null;
    let abs: URL;
    try {
      abs = base ? new URL(href, base) : new URL(href);
    } catch {
      return null;
    }
    if (abs.protocol !== 'http:' && abs.protocol !== 'https:') return null;
    return `${endpoint}?url=${encodeURIComponent(abs.toString())}&st=${encodeURIComponent(ctx.token)}`;
  };
}

function isStylesheetRel(rel: unknown): boolean {
  return typeof rel === 'string' && rel.toLowerCase().split(/\s+/).includes('stylesheet');
}

type SerializedNode = {
  id?: unknown;
  type?: unknown;
  tagName?: unknown;
  attributes?: Record<string, unknown>;
  childNodes?: unknown;
};

const FULL_SNAPSHOT = 2;
const INCREMENTAL = 3;
const META = 4;
const SOURCE_MUTATION = 0;
const NODE_ELEMENT = 2;

/**
 * Rewrites stylesheet links in rrweb events, in place, before they reach the player.
 *
 * Stateful across calls because a recording streams in chunk by chunk: a later chunk's
 * attribute mutation can change the `href` of a `<link>` an earlier chunk created, and only
 * the node id connects the two. Covers full snapshots, nodes added by mutations, and `href`
 * attribute changes on known stylesheet links. Links rrweb inlined (`_cssText`) are left alone.
 */
export function createReplayStylesheetRewriter(ctx: StylesheetArchiveContext) {
  const rewrite = stylesheetHrefRewriter(ctx);
  const linkIds = new Set<number>();
  let pageHref: string | undefined;

  const visit = (root: unknown) => {
    const stack: unknown[] = [root];
    while (stack.length > 0) {
      const node = stack.pop() as SerializedNode | null | undefined;
      if (!node || typeof node !== 'object') continue;
      if (
        node.type === NODE_ELEMENT &&
        typeof node.tagName === 'string' &&
        node.tagName.toLowerCase() === 'link' &&
        node.attributes &&
        isStylesheetRel(node.attributes.rel) &&
        node.attributes._cssText === undefined
      ) {
        if (typeof node.id === 'number') linkIds.add(node.id);
        const href = node.attributes.href;
        const next = typeof href === 'string' ? rewrite(href, pageHref) : null;
        if (next) node.attributes.href = next;
      }
      if (Array.isArray(node.childNodes)) {
        for (let i = node.childNodes.length - 1; i >= 0; i--) stack.push(node.childNodes[i]);
      }
    }
  };

  return (events: Array<{ type: number; data: Record<string, unknown> }>): void => {
    for (const ev of events) {
      const data = ev?.data;
      if (!data || typeof data !== 'object') continue;
      if (ev.type === META) {
        if (typeof data.href === 'string') pageHref = data.href;
        continue;
      }
      if (ev.type === FULL_SNAPSHOT) {
        visit(data.node);
        continue;
      }
      if (ev.type !== INCREMENTAL || data.source !== SOURCE_MUTATION) continue;
      if (Array.isArray(data.adds)) {
        for (const add of data.adds) visit((add as { node?: unknown } | null)?.node);
      }
      if (Array.isArray(data.attributes) && linkIds.size > 0) {
        for (const change of data.attributes as Array<{ id?: unknown; attributes?: Record<string, unknown> }>) {
          if (typeof change?.id !== 'number' || !linkIds.has(change.id)) continue;
          const href = change.attributes?.href;
          const next = typeof href === 'string' ? rewrite(href, pageHref) : null;
          if (next && change.attributes) change.attributes.href = next;
        }
      }
    }
  };
}

const LINK_TAG_RE = /<link\b[^>]*>/gi;
const BASE_TAG_RE = /<base\b[^>]*>/i;
const ATTR_RE = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

function decodeAttr(v: string): string {
  return v
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function encodeAttr(v: string): string {
  return v.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function tagAttributes(tag: string): Map<string, { value: string; start: number; end: number }> {
  const attrs = new Map<string, { value: string; start: number; end: number }>();
  const nameEnd = tag.match(/^<[a-z]+/i)?.[0].length ?? 0;
  ATTR_RE.lastIndex = nameEnd;
  for (let m = ATTR_RE.exec(tag); m; m = ATTR_RE.exec(tag)) {
    const name = m[1]!.toLowerCase();
    if (!attrs.has(name)) {
      attrs.set(name, { value: decodeAttr(m[2] ?? m[3] ?? m[4] ?? ''), start: m.index, end: m.index + m[0].length });
    }
  }
  return attrs;
}

/**
 * A stored page snapshot with its stylesheet links pointed at the archive. Relative hrefs are
 * resolved the way the snapshot itself would resolve them: against its `<base href>` (the
 * tracker adds one pointing at the site), else `pageUrl`. Everything else is left byte for byte.
 */
export function rewriteSnapshotStylesheets(html: string, ctx: StylesheetArchiveContext, pageUrl?: string): string {
  const rewrite = stylesheetHrefRewriter(ctx);
  let base = pageUrl;
  const baseTag = BASE_TAG_RE.exec(html);
  if (baseTag) {
    const href = tagAttributes(baseTag[0]).get('href')?.value;
    if (href) {
      try {
        base = new URL(href, pageUrl).toString();
      } catch {
        /* keep pageUrl */
      }
    }
  }
  return html.replace(LINK_TAG_RE, (tag) => {
    const attrs = tagAttributes(tag);
    if (!isStylesheetRel(attrs.get('rel')?.value)) return tag;
    const href = attrs.get('href');
    if (!href) return tag;
    const next = rewrite(href.value, base);
    if (!next) return tag;
    return `${tag.slice(0, href.start)}href="${encodeAttr(next)}"${tag.slice(href.end)}`;
  });
}
