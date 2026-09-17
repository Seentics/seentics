'use client';

import { usePathSegment } from '@/lib/path-segment';



import { PrivacySettingsComponent } from '@/components/settings/PrivacySettingsComponent';

export default function PrivacySettingsPage() {
  const params = { websiteId: usePathSegment(1) ?? '' };
  const websiteId = params?.websiteId as string;

  return (
    <div className="animate-in fade-in duration-500">
      <PrivacySettingsComponent websiteId={websiteId} />
    </div>
  );
}
