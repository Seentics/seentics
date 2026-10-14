'use client';

import { usePathSegment } from '@/lib/path-segment';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { AlertSettingsCard } from '@/components/settings/AlertSettingsCard';

export default function AlertsSettingsPage() {
  const websiteId = usePathSegment(1) ?? '';

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <DashboardPageHeader
        title="Alerts"
        description="Seentics checks your site every hour against what is usual for that hour of the week, and tells you when traffic drops or spikes, tracking stops, errors surge or conversions fall."
      />
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground px-1">Anomaly alerts</h2>
        <AlertSettingsCard websiteId={websiteId} />
      </section>
    </div>
  );
}
