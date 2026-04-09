'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

/** Goal list moved to the main analytics (Overview) page. */
export default function GoalsRedirectPage() {
  const { websiteId } = useParams<{ websiteId: string }>();
  const router = useRouter();

  useEffect(() => {
    if (!websiteId) return;
    router.replace(`/websites/${websiteId}`);
  }, [router, websiteId]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center p-8">
      <p className="text-sm text-muted-foreground">Redirecting to analytics…</p>
    </div>
  );
}
