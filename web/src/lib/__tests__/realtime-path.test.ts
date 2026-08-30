import { describe, expect, it } from 'vitest';
import {
  activityReferrerLabel,
  pathFromRaw,
  shortenSessionSlugInPath,
  stripWebsiteDashboardPrefix,
  displayRealtimePath,
} from '@/lib/realtime-path';

/**
 * URL normalisation for the realtime feed.
 *
 * The tracker sends whatever `location.href` was, so these helpers see absolute URLs,
 * protocol-relative URLs, bare paths, and occasionally garbage. Every branch has to
 * return *something* renderable — a throw here blanks a live table — which makes the
 * malformed cases the ones worth pinning.
 */

const WEBSITE = 'ab12cd34';

describe('pathFromRaw', () => {
  it('reduces an absolute URL to its path', () => {
    expect(pathFromRaw('https://example.com/pricing')).toBe('/pricing');
  });

  it('keeps the query string and fragment — they distinguish two views of one page', () => {
    expect(pathFromRaw('https://example.com/search?q=abc#top')).toBe('/search?q=abc#top');
  });

  it('renders a bare origin as the root path rather than an empty string', () => {
    expect(pathFromRaw('https://example.com')).toBe('/');
    expect(pathFromRaw('https://example.com/')).toBe('/');
  });

  it('handles a protocol-relative URL', () => {
    expect(pathFromRaw('//example.com/pricing')).toBe('/pricing');
  });

  it('leaves an already-relative path alone', () => {
    expect(pathFromRaw('/pricing')).toBe('/pricing');
  });

  it('adds a leading slash to a path that lacks one', () => {
    expect(pathFromRaw('pricing')).toBe('/pricing');
  });

  it('preserves an empty input rather than inventing a path', () => {
    expect(pathFromRaw('')).toBe('');
    expect(pathFromRaw('   ')).toBe('   ');
  });

  it('falls back to the raw value when the URL will not parse', () => {
    expect(pathFromRaw('http://')).toBe('/http://');
    expect(pathFromRaw('https://[bad')).toBe('/https://[bad');
  });

  it('is case-insensitive about the scheme', () => {
    expect(pathFromRaw('HTTPS://example.com/x')).toBe('/x');
  });

  it('does not treat a non-http scheme as absolute', () => {
    expect(pathFromRaw('javascript:alert(1)')).toBe('/javascript:alert(1)');
  });
});

describe('stripWebsiteDashboardPrefix', () => {
  it('removes the dashboard prefix from a nested path', () => {
    expect(stripWebsiteDashboardPrefix(`/websites/${WEBSITE}/realtime`, WEBSITE)).toBe('/realtime');
  });

  it('collapses the dashboard root to /', () => {
    expect(stripWebsiteDashboardPrefix(`/websites/${WEBSITE}`, WEBSITE)).toBe('/');
    expect(stripWebsiteDashboardPrefix(`/websites/${WEBSITE}/`, WEBSITE)).toBe('/');
  });

  it('leaves an unrelated path untouched', () => {
    expect(stripWebsiteDashboardPrefix('/pricing', WEBSITE)).toBe('/pricing');
  });

  it('does not strip another site id', () => {
    expect(stripWebsiteDashboardPrefix('/websites/other/realtime', WEBSITE)).toBe(
      '/websites/other/realtime',
    );
  });

  it('does not strip a site id that merely starts with the same characters', () => {
    // `/websites/ab12cd34x` shares a prefix with `/websites/ab12cd34`; a naive
    // startsWith without the trailing slash would mangle it.
    expect(stripWebsiteDashboardPrefix(`/websites/${WEBSITE}x/page`, WEBSITE)).toBe(
      `/websites/${WEBSITE}x/page`,
    );
  });

  it('is a no-op when no website id is supplied', () => {
    expect(stripWebsiteDashboardPrefix(`/websites/${WEBSITE}/realtime`, '')).toBe(
      `/websites/${WEBSITE}/realtime`,
    );
  });
});

describe('shortenSessionSlugInPath', () => {
  it('elides the middle of a long session id', () => {
    const out = shortenSessionSlugInPath('/replays/s-abcdefghijklmnop');
    expect(out).toBe('/replays/s-…klmnop');
    expect(out.length).toBeLessThan('/replays/s-abcdefghijklmnop'.length);
  });

  it('leaves a short session id readable in full', () => {
    expect(shortenSessionSlugInPath('/replays/s-abc123')).toBe('/replays/s-abc123');
  });

  it('keeps a ten-character id whole and shortens an eleven-character one', () => {
    expect(shortenSessionSlugInPath('/replays/s-0123456789')).toBe('/replays/s-0123456789');
    expect(shortenSessionSlugInPath('/replays/s-01234567890')).toBe('/replays/s-…567890');
  });

  it('shortens every session id in a path, not just the first', () => {
    expect(shortenSessionSlugInPath('/replays/s-abcdefghijklmnop/x/replays/s-qrstuvwxyz012')).toBe(
      '/replays/s-…klmnop/x/replays/s-…wxyz012'.replace('wxyz012', 'vwxyz012'.slice(-6)),
    );
  });

  it('ignores a session-looking slug outside a replays path', () => {
    expect(shortenSessionSlugInPath('/other/s-abcdefghijklmnop')).toBe(
      '/other/s-abcdefghijklmnop',
    );
  });

  it('leaves a path with no session id untouched', () => {
    expect(shortenSessionSlugInPath('/pricing')).toBe('/pricing');
  });
});

describe('displayRealtimePath', () => {
  it('composes all three steps: parse, strip, shorten', () => {
    expect(
      displayRealtimePath(
        `https://app.example.com/websites/${WEBSITE}/replays/s-abcdefghijklmnop`,
        WEBSITE,
      ),
    ).toBe('/replays/s-…klmnop');
  });

  it('truncates past the length budget with an ellipsis', () => {
    const long = `/${'a'.repeat(80)}`;
    const out = displayRealtimePath(long, WEBSITE);
    expect(out).toHaveLength(56);
    expect(out.endsWith('…')).toBe(true);
  });

  it('honours a custom length budget', () => {
    const out = displayRealtimePath(`/${'a'.repeat(40)}`, WEBSITE, 10);
    expect(out).toHaveLength(10);
    expect(out).toBe('/aaaaaaaa…');
  });

  it('leaves a path exactly at the budget untruncated', () => {
    const exact = `/${'a'.repeat(55)}`;
    expect(displayRealtimePath(exact, WEBSITE)).toBe(exact);
    expect(displayRealtimePath(exact, WEBSITE)).not.toContain('…');
  });

  it('always returns a path beginning with a slash', () => {
    for (const raw of ['pricing', 'https://x.com/y', '', '//x.com/z']) {
      expect(displayRealtimePath(raw, WEBSITE).startsWith('/')).toBe(true);
    }
  });
});

describe('activityReferrerLabel', () => {
  it('reduces an external referrer to its hostname', () => {
    expect(activityReferrerLabel('https://www.google.com/search?q=x')).toBe('google.com');
  });

  it('strips only a leading www', () => {
    expect(activityReferrerLabel('https://www.example.com')).toBe('example.com');
    expect(activityReferrerLabel('https://wwwx.example.com')).toBe('wwwx.example.com');
  });

  it('keeps other subdomains — news.ycombinator.com is not ycombinator.com', () => {
    expect(activityReferrerLabel('https://news.ycombinator.com/item?id=1')).toBe(
      'news.ycombinator.com',
    );
  });

  it('accepts a bare hostname with no scheme', () => {
    expect(activityReferrerLabel('google.com/search')).toBe('google.com');
  });

  it('returns an empty label for an empty referrer, not a placeholder', () => {
    expect(activityReferrerLabel('')).toBe('');
  });

  it('shows the path for a localhost referrer, since the hostname says nothing', () => {
    expect(activityReferrerLabel('http://localhost:3000/pricing')).toBe('/pricing');
    expect(activityReferrerLabel('http://127.0.0.1:3000/pricing')).toBe('/pricing');
  });

  it('applies the dashboard-prefix strip to a localhost path when given a site id', () => {
    expect(
      activityReferrerLabel(`http://localhost:3000/websites/${WEBSITE}/realtime`, WEBSITE),
    ).toBe('/realtime');
  });

  it('shortens a session id inside a localhost path', () => {
    expect(
      activityReferrerLabel(
        `http://localhost:3000/websites/${WEBSITE}/replays/s-abcdefghijklmnop`,
        WEBSITE,
      ),
    ).toBe('/replays/s-…klmnop');
  });

  it('truncates a very long localhost path', () => {
    const out = activityReferrerLabel(`http://localhost:3000/${'a'.repeat(100)}`);
    expect(out).toHaveLength(52);
    expect(out.endsWith('…')).toBe(true);
  });

  it('truncates an unparseable referrer rather than throwing', () => {
    // 21 characters plus the ellipsis — the budget is a `> 24` test but a 22-character
    // result, which is worth stating explicitly since the two numbers differ.
    const out = activityReferrerLabel('::::not a url at all, really quite long ::::');
    expect(out).toHaveLength(22);
    expect(out.endsWith('…')).toBe(true);
    expect(out).toBe('::::not a url at all,…');
  });

  it('leaves a referrer exactly at the 24-character threshold intact', () => {
    const exact = 'a'.repeat(24);
    expect(activityReferrerLabel(exact)).toBe(exact);
  });

  it('returns a short unparseable referrer as-is', () => {
    expect(activityReferrerLabel('¯\\_(ツ)_/¯')).toBe('¯\\_(ツ)_/¯');
  });
});
