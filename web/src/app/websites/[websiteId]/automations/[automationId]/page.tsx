import AutomationDetailPage from './page-client';

// See src/lib/path-segment.ts for why this wrapper exists and why the
// placeholder below is never the value actually shown to a visitor.
export function generateStaticParams() {
  return [{ websiteId: 'w-leaf', automationId: 'w-child' }];
}

export const dynamicParams = false;

export default function Page() {
  return <AutomationDetailPage />;
}
