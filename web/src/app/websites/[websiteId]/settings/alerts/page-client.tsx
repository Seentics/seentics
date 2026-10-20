'use client';

import { usePathSegment } from '@/lib/path-segment';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { AlertSettingsCard } from '@/components/settings/AlertSettingsCard';
import { useT } from '@/lib/i18n';

export default function AlertsSettingsPage() {
  const websiteId = usePathSegment(1) ?? '';
  const t = useT().settings.alertsPage;

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <DashboardPageHeader
        title={t.title}
        description={t.description}
      />
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground px-1">{t.anomaly}</h2>
        <AlertSettingsCard websiteId={websiteId} />
      </section>
    </div>
  );
}
