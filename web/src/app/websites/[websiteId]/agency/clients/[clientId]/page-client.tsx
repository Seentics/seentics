'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePathSegment } from '@/lib/path-segment';
import type { AgencyClient } from '@/features/agency/types';
import { ClientDetail } from '@/components/agency/ClientDetail';
import { ClientFormDialog } from '@/components/agency/ClientFormDialog';

/** One client's own page: `/websites/:id/agency/clients/:clientId`. */
export default function ClientPage() {
  const router = useRouter();
  const websiteId = usePathSegment(1) ?? '';
  const clientId = usePathSegment(4) ?? '';
  const [editing, setEditing] = useState<AgencyClient | null>(null);

  return (
    <div className="mx-auto w-full max-w-[1440px] p-4 md:p-6 lg:p-8">
      {websiteId && clientId && (
        <ClientDetail
          websiteId={websiteId}
          clientId={clientId}
          onBack={() => router.push(`/websites/${websiteId}/agency`)}
          onEdit={setEditing}
        />
      )}
      <ClientFormDialog
        websiteId={websiteId}
        open={!!editing}
        onOpenChange={open => { if (!open) setEditing(null); }}
        initial={editing}
      />
    </div>
  );
}
