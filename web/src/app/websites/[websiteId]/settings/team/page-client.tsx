'use client';

import { usePathSegment } from '@/lib/path-segment';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isEnterprise } from '@/lib/features';
import { TeamSettingsComponent } from '@/components/settings/TeamSettingsComponent';
import { SuiteRolesComponent } from '@/components/settings/SuiteRolesComponent';

export default function TeamSettings() {
  const params = { websiteId: usePathSegment(1) ?? '' };
  const websiteId = params?.websiteId as string;
  const router = useRouter();

  useEffect(() => {
    if (!isEnterprise) {
      router.replace(`/websites/${websiteId}/settings`);
    }
  }, [router, websiteId]);

  if (!isEnterprise) return null;

  return (
    <div className="space-y-10 p-4 sm:p-8 animate-in fade-in duration-500">
      <TeamSettingsComponent websiteId={websiteId} />
      {/* Below the website members, not beside them: who may open this site is
          this app's answer, and what they may do across the suite is the
          gateway's. Both apply, and the order reflects which one a visitor to
          this page came for. */}
      <SuiteRolesComponent />
    </div>
  );
}
