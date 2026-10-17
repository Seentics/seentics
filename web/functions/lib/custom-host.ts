// Agencies' own domains (reports.agency.com, CNAMEd to us through Cloudflare for SaaS) are
// connected and verified in phase 1, but nothing is served on them yet: never Seentics' marketing
// site, dashboard or API. Phase 3 serves the full dashboard and a branded sign-in there (see
// docs/agency-workspace.md). This is the request-side half, kept free of the Pages runtime so it
// can be unit-tested.

/** Our own hosts, which this logic leaves alone. */
export function isSeenticsHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/\.$/, '');
  return (
    h === 'seentics.com' ||
    h.endsWith('.seentics.com') ||
    h.endsWith('.pages.dev') ||
    h === 'localhost' ||
    h === '127.0.0.1' ||
    h === '[::1]'
  );
}

export type CustomHostDecision = 'not-found';

/** For a request to a host that is not ours. Until phase 3 serves the dashboard there: nothing. */
export function decideCustomHostRequest(_pathname: string): CustomHostDecision {
  return 'not-found';
}
