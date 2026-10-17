import ClientPage from './page-client';

// See src/lib/path-segment.ts for why this wrapper exists and why the
// placeholder below is never the value actually shown to a visitor:
// public/_redirects serves every /agency/clients/:clientId from this shell.
export function generateStaticParams() {
  return [{ clientId: 'c-leaf' }];
}

export const dynamicParams = false;

export default function Page() {
  return <ClientPage />;
}
