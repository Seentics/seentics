'use client';

import { usePathSegment } from '@/lib/path-segment';

import { useState } from 'react';

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { WebsitesSettingsPanel } from '@/components/settings/WebsitesSettingsPanel';
import { AddWebsiteModal } from '@/components/websites/AddWebsiteModal';
import { WebsiteProfileCard } from '@/components/settings/WebsiteProfileCard';
import { useT } from '@/lib/i18n';

export default function SettingsWebsitesPage() {
  const params = { websiteId: usePathSegment(1) ?? '' };
  const [addOpen, setAddOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const t = useT().settings.websitesPage;

  const handleAddSuccess = () => {
    setAddOpen(false);
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-500 w-full">
      <AddWebsiteModal open={addOpen} onOpenChange={setAddOpen} onSuccess={handleAddSuccess} />

      <DashboardPageHeader
        title={t.title}
        description={t.description}
      >
        <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" />
          {t.add}
        </Button>
      </DashboardPageHeader>

      {params.websiteId && <WebsiteProfileCard websiteId={params.websiteId} />}

      <WebsitesSettingsPanel key={refreshKey} redirectWhenEmpty={false} hideAddButton={true} />
    </div>
  );
}
