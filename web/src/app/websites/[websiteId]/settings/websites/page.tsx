'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { WebsitesSettingsPanel } from '@/components/settings/WebsitesSettingsPanel';
import { AddWebsiteModal } from '@/components/websites/AddWebsiteModal';

export default function SettingsWebsitesPage() {
  const params = useParams();
  const websiteId = params?.websiteId as string;
  const [addOpen, setAddOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleAddSuccess = () => {
    setAddOpen(false);
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-500 w-full">
      <AddWebsiteModal open={addOpen} onOpenChange={setAddOpen} onSuccess={handleAddSuccess} />

      <DashboardPageHeader
        title="Websites"
        description="Add properties, copy tracking snippets, edit details, or remove sites from your account."
      >
        <Button size="sm" className="gap-1.5" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4" />
          Add website
        </Button>
      </DashboardPageHeader>

      <WebsitesSettingsPanel key={refreshKey} redirectWhenEmpty={false} hideAddButton={true} />
    </div>
  );
}
