/**
 * Finding the stylesheet URLs a recording or a page snapshot links to.
 *
 * Runs on the ingest path, so it is cheap by construction: only rrweb full snapshots
 * (type 2) and DOM-mutation incrementals (type 3, source 0) are walked, the walk is
 * iterative, and it stops as soon as `limit` distinct URLs are found.
 */

/** Distinct stylesheet URLs taken from one chunk, one session or one snapshot. */
export const MAX_STYLESHEETS_PER_SCAN = 50;

/** Longer URLs are not archived: nothing legitimate needs one, and each is a row. */
export const MAX_STYLESHEET_URL_LENGTH = 2048;

const RRWEB_FULL_SNAPSHOT = 2;
const RRWEB_INCREMENTAL = 3;
const RRWEB_SOURCE_MUTATION = 0;
const RRWEB_NODE_ELEMENT = 2;

/** `rel` names a stylesheet (`stylesheet`, `alternate stylesheet`, any case). */
export function isStylesheetRel(rel: unknown): boolean {
  if (typeof rel !== "string") return false;
  return rel.toLowerCase().split(/\s+/).includes("stylesheet");
}

/** An absolute http(s) URL for `href`, or `null` for anything that cannot be archived. */
export function absoluteStylesheetUrl(href: unknown, base: string | undefined): string | null {
  if (typeof href !== "string") return null;
  const trimmed = href.trim();
  if (!trimmed || trimmed.length > MAX_STYLESHEET_URL_LENGTH) return null;
  let u: URL;
  try {
    u = base ? new URL(trimmed, base) : new URL(trimmed);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  // The fragment never reaches the server, so two URLs differing only there are one file.
  u.hash = "";
  const out = u.toString();
  return out.length > MAX_STYLESHEET_URL_LENGTH ? null : out;
}

type SerializedNode = {
  type?: unknown;
  tagName?: unknown;
  attributes?: Record<string, unknown>;
  childNodes?: unknown;
};

/** Collects distinct URLs up to a limit. */
class UrlSet {
  readonly urls = new Set<string>();
  constructor(private readonly limit: number) {}
  get full(): boolean {
    return this.urls.size >= this.limit;
  }
  add(url: string | null): void {
    if (url && !this.full) this.urls.add(url);
  }
}

/** Walk one serialized rrweb node tree for stylesheet links, without recursion. */
function collectFromNode(root: unknown, base: string | undefined, out: UrlSet): void {
  const stack: unknown[] = [root];
  while (stack.length > 0 && !out.full) {
    const node = stack.pop() as SerializedNode | null | undefined;
    if (!node || typeof node !== "object") continue;
    if (node.type === RRWEB_NODE_ELEMENT && typeof node.tagName === "string" && node.tagName.toLowerCase() === "link") {
      const attrs = node.attributes;
      // `_cssText` means rrweb inlined the sheet already: nothing to archive.
      if (attrs && isStylesheetRel(attrs.rel) && attrs._cssText === undefined) {
        out.add(absoluteStylesheetUrl(attrs.href, base));
      }
    }
    if (Array.isArray(node.childNodes)) {
      for (let i = node.childNodes.length - 1; i >= 0; i--) stack.push(node.childNodes[i]);
    }
  }
}

/**
 * Stylesheet URLs linked from stored replay events — the tracker's envelopes
 * (`{ type: "rrweb", url, data: <rrweb event> }`) or bare rrweb events.
 *
 * rrweb already writes `href` absolute; a relative one is resolved against the envelope's
 * page URL.
 */
export function stylesheetUrlsFromReplayEvents(
  events: Iterable<unknown>,
  limit: number = MAX_STYLESHEETS_PER_SCAN,
): string[] {
  const out = new UrlSet(limit);
  for (const raw of events) {
    if (out.full) break;
    if (!raw || typeof raw !== "object") continue;
    const envelope = raw as Record<string, unknown>;
    const isEnvelope = envelope.type === "rrweb";
    const ev = (isEnvelope ? envelope.data : envelope) as Record<string, unknown> | undefined;
    if (!ev || typeof ev !== "object") continue;
    const type = Number(ev.type);
    if (type !== RRWEB_FULL_SNAPSHOT && type !== RRWEB_INCREMENTAL) continue;
    const data = ev.data as Record<string, unknown> | undefined;
    if (!data || typeof data !== "object") continue;
    const base = isEnvelope && typeof envelope.url === "string" && envelope.url ? envelope.url : undefined;

    if (type === RRWEB_FULL_SNAPSHOT) {
      collectFromNode(data.node, base, out);
      continue;
    }
    if (Number(data.source) !== RRWEB_SOURCE_MUTATION || !Array.isArray(data.adds)) continue;
    for (const add of data.adds) {
      if (out.full) break;
      if (add && typeof add === "object") collectFromNode((add as Record<string, unknown>).node, base, out);
    }
  }
  return [...out.urls];
}

const LINK_TAG_RE = /<link\b[^>]*>/gi;
const BASE_TAG_RE = /<base\b[^>]*>/i;
const ATTR_RE = /([^\s"'<>\/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

/** The few entities an attribute value realistically carries in serialized HTML. */
function decodeAttr(v: string): string {
  return v
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/** Attributes of one start tag, lower-cased names, decoded values. */
export function tagAttributes(tag: string): Record<string, string> {
  const inner = tag.replace(/^<[a-z]+/i, "").replace(/\/?>$/, "");
  const attrs: Record<string, string> = {};
  for (const m of inner.matchAll(ATTR_RE)) {
    const name = m[1]!.toLowerCase();
    if (name in attrs) continue;
    attrs[name] = decodeAttr(m[2] ?? m[3] ?? m[4] ?? "");
  }
  return attrs;
}

/**
 * Stylesheet URLs a serialized page links to, resolved the way a browser rendering it
 * would: against its `<base href>` (the tracker inserts one pointing at the site's
 * origin), else against the page URL.
 */
export function stylesheetUrlsFromHtml(
  html: string,
  pageUrl: string,
  limit: number = MAX_STYLESHEETS_PER_SCAN,
): string[] {
  let base: string | undefined = absoluteStylesheetUrl(pageUrl, undefined) ?? undefined;
  const baseTag = BASE_TAG_RE.exec(html);
  if (baseTag) {
    const href = tagAttributes(baseTag[0]).href;
    const resolved = href ? absoluteStylesheetUrl(href, base) : null;
    if (resolved) base = resolved;
  }
  const out = new UrlSet(limit);
  for (const m of html.matchAll(LINK_TAG_RE)) {
    if (out.full) break;
    const attrs = tagAttributes(m[0]);
    if (!isStylesheetRel(attrs.rel)) continue;
    out.add(absoluteStylesheetUrl(attrs.href, base));
  }
  return [...out.urls];
}
