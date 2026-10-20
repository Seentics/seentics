'use client';

import { usePathSegment } from '@/lib/path-segment';



import { GoalsSettingsComponent } from '@/components/settings/GoalsSettingsComponent';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { useT } from '@/lib/i18n';

export default function GoalConversionsPage() {
  const params = { websiteId: usePathSegment(1) ?? '' };
  const websiteId = params?.websiteId as string;
  const t = useT().settings.goalsPage;

  return (
    <div className="space-y-8 p-4 sm:p-8 animate-in fade-in duration-500">
      <DashboardPageHeader
        websiteId={websiteId}
        title={t.title}
        description={t.description}
      />
      <GoalsSettingsComponent websiteId={websiteId} />
    </div>
  );
}
