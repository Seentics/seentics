'use client';

import React, { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { isEnterprise } from '@/lib/features';
import { TeamSettingsComponent } from '@/components/settings/TeamSettingsComponent';

export default function TeamSettings() {
  const params = useParams();
  const websiteId = params?.websiteId as string;
  const router = useRouter();

  useEffect(() => {
    if (!isEnterprise) {
      router.replace(`/websites/${websiteId}/settings`);
    }
  }, [router, websiteId]);

  if (!isEnterprise) return null;

  return (
    <div className="space-y-6 p-4 sm:p-8 animate-in fade-in duration-500">
      <TeamSettingsComponent websiteId={websiteId} />
    </div>
  );
}
