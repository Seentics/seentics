'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePathSegment } from '@/lib/path-segment';

/**
 * Privacy lives under Settings. This route rendered the same settings component as a
 * second, unlinked copy of the page; it now forwards old links there. Client-side for the
 * reason `settings/tracking` is — see src/lib/path-segment.ts.
 */
export default function PrivacyRedirectPage() {
  const websiteId = usePathSegment(1); // /websites/:websiteId/privacy
  const router = useRouter();

  useEffect(() => {
    if (websiteId) router.replace(`/websites/${websiteId}/settings/privacy`);
  }, [websiteId, router]);

  return null;
}
