import ClientUserDetailPage from './page-client';

// See src/lib/path-segment.ts for why this wrapper exists and why the
// placeholder below is never the value actually shown to a visitor.
export function generateStaticParams() {
  return [{ userId: 'shell' }];
}

export const dynamicParams = false;

export default function Page() {
  return <ClientUserDetailPage />;
}
