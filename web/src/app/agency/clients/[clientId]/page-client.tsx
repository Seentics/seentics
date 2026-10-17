'use client';

import { usePathSegment } from '@/lib/path-segment';
import { ClientDetailView } from '@/components/agency-workspace/ClientDetailView';

/** One client: `/agency/clients/:clientId`, the id read from the URL (see lib/path-segment). */
export default function ClientPage() {
  const clientId = usePathSegment(2) ?? '';
  return <ClientDetailView clientId={clientId} />;
}
