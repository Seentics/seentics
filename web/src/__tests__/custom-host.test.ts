import { describe, expect, it } from 'vitest';
import { decideCustomHostRequest, isSeenticsHost } from '../../functions/lib/custom-host';

describe('isSeenticsHost', () => {
  it('knows our own hosts', () => {
    for (const h of ['seentics.com', 'www.seentics.com', 'portal.seentics.com', 'SEENTICS.COM.', 'seentics-web.pages.dev', 'abc123.seentics-web.pages.dev', 'localhost', '127.0.0.1']) {
      expect([h, isSeenticsHost(h)]).toEqual([h, true]);
    }
  });

  it('treats anything else as an agency domain', () => {
    for (const h of ['reports.agency.com', 'seentics.com.evil.test', 'notseentics.com', 'pages.dev.agency.com']) {
      expect([h, isSeenticsHost(h)]).toEqual([h, false]);
    }
  });
});

describe('decideCustomHostRequest', () => {
  // Phase 3 serves the dashboard on agency domains; until then nothing is served there.
  it('serves nothing on an agency domain: no marketing, dashboard, docs, API, embeds or assets', () => {
    for (const p of ['/', '/pricing', '/websites/abc', '/signin', '/docs/agency', '/api/v1/user/auth/me', '/embed/w1', '/client-portal/scp_abc', '/_next/static/x.js', '/favicon.ico']) {
      expect([p, decideCustomHostRequest(p)]).toEqual([p, 'not-found']);
    }
  });
});
