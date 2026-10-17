import type { Metadata } from 'next';
import ClientPortalPage from './page-client';

// See src/lib/path-segment.ts for why this wrapper exists and why the
// placeholder below is never the value actually shown to a visitor.
export function generateStaticParams() {
  return [{ token: 'shell' }];
}

export const dynamicParams = false;

/**
 * The token is in the URL, so no request from this page may carry it on as a Referer (public/_headers
 * sends the same policy as a header). The portal may be on an agency's own domain under its own
 * brand: none of the root layout's Seentics title, description or share cards.
 */
export const metadata: Metadata = {
  title: 'Client portal',
  description: null,
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
  openGraph: null,
  twitter: null,
};

export default function Page() {
  return <ClientPortalPage />;
}
