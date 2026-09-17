'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePathSegment } from '@/lib/path-segment';

/**
 * This used to be a Server Component calling `redirect()` — static export
 * has no server left to run that per-request, and a build-time bake would
 * redirect to whatever placeholder websiteId the shell was built for, not
 * the real one. Reads the real id from the URL and redirects client-side
 * instead — see src/lib/path-segment.ts.
 */
export default function TrackingSettingsRedirectPage() {
  const websiteId = usePathSegment(1); // /websites/:websiteId/settings/tracking
  const router = useRouter();

  useEffect(() => {
    if (websiteId) router.replace(`/websites/${websiteId}/settings/websites`);
  }, [websiteId, router]);

  return null;
}
