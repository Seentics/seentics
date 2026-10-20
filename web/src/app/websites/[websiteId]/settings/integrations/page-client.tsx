'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePathSegment } from '@/lib/path-segment';

/** Integrations has its own page now (/websites/:id/integrations); old links and bookmarks land there. */
export default function IntegrationsMoved() {
  const websiteId = usePathSegment(1) ?? '';
  const router = useRouter();
  useEffect(() => {
    if (websiteId) router.replace(`/websites/${websiteId}/integrations`);
  }, [websiteId, router]);
  return null;
}
