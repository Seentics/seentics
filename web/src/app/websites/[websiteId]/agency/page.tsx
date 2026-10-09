import AgencyPage from './page-client';

// See src/lib/path-segment.ts for why this wrapper exists and why the
// placeholder below is never the value actually shown to a visitor.
// 'w-idx': this page has a child route (clients/[clientId]).
export function generateStaticParams() {
  return [{ websiteId: 'w-idx' }];
}

export const dynamicParams = false;

export default function Page() {
  return <AgencyPage />;
}
