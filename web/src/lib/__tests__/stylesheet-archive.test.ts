import { describe, expect, it } from 'vitest';
import {
  createReplayStylesheetRewriter,
  rewriteSnapshotStylesheets,
  stylesheetHrefRewriter,
} from '@/lib/stylesheet-archive';

const SITE = '11111111-1111-4111-8111-111111111111';
const CTX = { websiteId: SITE, token: '1760659200.abc_-' };
const CSS = 'https://shop.test/_next/static/css/3e3ba49c0fe97c41.css';

const archived = (url: string) =>
  `${window.location.origin}/api/v1/embed/${SITE}/stylesheet?url=${encodeURIComponent(url)}&st=${encodeURIComponent(CTX.token)}`;

const link = (id: number, attributes: Record<string, unknown>) => ({ type: 2, id, tagName: 'link', attributes, childNodes: [] });

function fullSnapshot(children: unknown[]) {
  return {
    type: 2,
    timestamp: 1,
    data: { node: { type: 0, id: 1, childNodes: [{ type: 2, id: 2, tagName: 'html', attributes: {}, childNodes: [{ type: 2, id: 3, tagName: 'head', attributes: {}, childNodes: children }] }] } },
  };
}

describe('stylesheetHrefRewriter', () => {
  it('points an http(s) stylesheet at the absolute archive endpoint, with the token', () => {
    const rewrite = stylesheetHrefRewriter(CTX);
    expect(rewrite(CSS)).toBe(archived(CSS));
    expect(rewrite('/a.css', 'https://shop.test/p/1')).toBe(archived('https://shop.test/a.css'));
  });

  it('leaves data:, unparseable and already-archived hrefs alone', () => {
    const rewrite = stylesheetHrefRewriter(CTX);
    expect(rewrite('data:text/css,body{}')).toBeNull();
    expect(rewrite('relative.css')).toBeNull();
    expect(rewrite(archived(CSS))).toBeNull();
  });
});

describe('createReplayStylesheetRewriter', () => {
  it('rewrites stylesheet links in a full snapshot and leaves everything else', () => {
    const events = [
      fullSnapshot([
        link(10, { rel: 'stylesheet', href: CSS }),
        link(11, { rel: 'icon', href: 'https://shop.test/favicon.ico' }),
        link(12, { rel: 'stylesheet', href: 'https://shop.test/inlined.css', _cssText: 'a{}' }),
        link(13, { rel: 'preload', as: 'style', href: 'https://shop.test/p.css' }),
      ]),
    ];
    createReplayStylesheetRewriter(CTX)(events);
    const head = (events[0]!.data.node as any).childNodes[0].childNodes[0].childNodes;
    expect(head[0].attributes.href).toBe(archived(CSS));
    expect(head[1].attributes.href).toBe('https://shop.test/favicon.ico');
    expect(head[2].attributes.href).toBe('https://shop.test/inlined.css');
    expect(head[3].attributes.href).toBe('https://shop.test/p.css');
  });

  it('rewrites links added by mutations, and a later href change to a known link — across chunks', () => {
    const rewrite = createReplayStylesheetRewriter(CTX);
    const meta = { type: 4, timestamp: 0, data: { href: 'https://shop.test/products/1', width: 1, height: 1 } };
    const added = {
      type: 3,
      timestamp: 2,
      data: { source: 0, adds: [{ parentId: 3, nextId: null, node: link(20, { rel: 'stylesheet', href: '../late.css' }) }], removes: [], texts: [], attributes: [] },
    };
    rewrite([meta, added]);
    expect((added.data.adds[0]!.node as any).attributes.href).toBe(archived('https://shop.test/late.css'));

    // Next chunk: the same node's href changes; an unrelated node's href does not get touched.
    const changed = {
      type: 3,
      timestamp: 3,
      data: { source: 0, adds: [], removes: [], texts: [], attributes: [
        { id: 20, attributes: { href: 'https://shop.test/v2.css' } },
        { id: 99, attributes: { href: 'https://shop.test/not-a-stylesheet' } },
      ] },
    };
    rewrite([changed]);
    expect(changed.data.attributes[0]!.attributes.href).toBe(archived('https://shop.test/v2.css'));
    expect(changed.data.attributes[1]!.attributes.href).toBe('https://shop.test/not-a-stylesheet');
  });

  it('ignores mouse and scroll incrementals', () => {
    const ev = { type: 3, timestamp: 1, data: { source: 1, positions: [{ x: 1, y: 1, id: 1, timeOffset: 0 }] } };
    const before = JSON.stringify(ev);
    createReplayStylesheetRewriter(CTX)([ev]);
    expect(JSON.stringify(ev)).toBe(before);
  });
});

describe('rewriteSnapshotStylesheets', () => {
  it('resolves against the snapshot <base> and rewrites only stylesheet links, byte-for-byte elsewhere', () => {
    const html = `<!DOCTYPE html><meta http-equiv="Content-Security-Policy" content="connect-src 'none'"><html><head><base href="https://shop.test/"><link rel="stylesheet" href="_next/static/css/a.css" data-n-g=""><link rel=icon href="/f.ico"><link href='/b.css?v=1&amp;x=2' rel='stylesheet'></head><body><p>hi</p></body></html>`;
    const out = rewriteSnapshotStylesheets(html, CTX, 'https://shop.test/deep/page');
    const amp = (s: string) => s.replace(/&/g, '&amp;');
    expect(out).toBe(
      html
        .replace('href="_next/static/css/a.css"', `href="${amp(archived('https://shop.test/_next/static/css/a.css'))}"`)
        .replace(`href='/b.css?v=1&amp;x=2'`, `href="${amp(archived('https://shop.test/b.css?v=1&x=2'))}"`),
    );
  });

  it('returns a snapshot without stylesheet links unchanged', () => {
    const html = '<html><head><link rel="icon" href="/x.ico"></head><body></body></html>';
    expect(rewriteSnapshotStylesheets(html, CTX, 'https://shop.test/')).toBe(html);
  });
});
