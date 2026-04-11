'use client';

import { DashboardPageHeader } from '@/components/dashboard-header';
import { WebsitesSettingsPanel } from '@/components/settings/WebsitesSettingsPanel';

export default function SettingsWebsitesPage() {
  return (
    <div className="space-y-8 p-4 sm:p-8 animate-in fade-in duration-500">
      <DashboardPageHeader
        title="Websites"
        description="Add properties, copy tracking snippets, edit details, or remove sites from your account."
      />
      <WebsitesSettingsPanel redirectWhenEmpty={false} />
    </div>
  );
}
