'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { PrivacySettingsComponent } from '@/components/settings/PrivacySettingsComponent';

export default function PrivacySettingsPage() {
  const params = useParams();
  const websiteId = params?.websiteId as string;

  return (
    <div className="animate-in fade-in duration-500">
      <PrivacySettingsComponent websiteId={websiteId} />
    </div>
  );
}
