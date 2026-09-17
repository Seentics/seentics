import TrackingSettingsRedirectPage from './page-client';

// See src/lib/path-segment.ts for why this wrapper exists.
export function generateStaticParams() {
  return [{ websiteId: 'w-leaf' }];
}

export const dynamicParams = false;

export default function Page() {
  return <TrackingSettingsRedirectPage />;
}
