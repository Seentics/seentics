import EmbedPage from './page-client';

// See src/lib/path-segment.ts for why this wrapper exists and why the
// placeholder below is never the value actually shown to a visitor.
export function generateStaticParams() {
  return [{ websiteId: 'shell' }];
}

export const dynamicParams = false;

export const metadata = { robots: { index: false, follow: false } };

export default function Page() {
  return <EmbedPage />;
}
