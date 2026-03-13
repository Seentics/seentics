'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { PrivacySettingsComponent } from '@/components/settings/PrivacySettingsComponent';

export default function PrivacySettingsPage() {
  const params = useParams();
  const websiteId = params?.websiteId as string;

  return (
    <div className="p-4 sm:p-8 max-w-[1440px] mx-auto">
      <PrivacySettingsComponent websiteId={websiteId} />
    </div>
  );
}
