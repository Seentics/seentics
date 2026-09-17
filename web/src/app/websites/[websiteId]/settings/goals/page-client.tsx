'use client';

import { usePathSegment } from '@/lib/path-segment';



import { GoalsSettingsComponent } from '@/components/settings/GoalsSettingsComponent';
import { DashboardPageHeader } from '@/components/dashboard-header';

export default function GoalConversionsPage() {
  const params = { websiteId: usePathSegment(1) ?? '' };
  const websiteId = params?.websiteId as string;

  return (
    <div className="space-y-8 p-4 sm:p-8 animate-in fade-in duration-500">
      <DashboardPageHeader
        websiteId={websiteId}
        title="Goal Conversions"
        description="Define what success looks like for your website."
      />
      <GoalsSettingsComponent websiteId={websiteId} />
    </div>
  );
}
