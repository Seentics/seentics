'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { getWebsites } from '@/lib/websites-api';

/** Legacy `/workspace/settings` → first site Profile in Settings. */
export default function LegacyWorkspaceSettingsRedirect() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const sites = await getWebsites();
      if (cancelled) return;
      if (sites[0]) {
        router.replace(`/websites/${sites[0].id}/settings/profile`);
      } else {
        router.replace('/websites');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}
