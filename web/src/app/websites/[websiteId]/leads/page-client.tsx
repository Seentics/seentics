'use client';

import { useState } from 'react';
import { ChevronLeft, Download, Search, UserPlus, Users } from 'lucide-react';
import { usePathSegment } from '@/lib/path-segment';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { GHOST_CONTROL } from '@/components/ui/ghost-control';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { StatCards } from '@/components/seentics-ui/StatCards';
import { ContactDetail } from '@/components/leads/contact-detail';
import { ContactList } from '@/components/leads/contact-list';
import { leadsApi } from '@/features/leads/api';
import { useDeleteContact, useSetContactStatus } from '@/features/leads/mutations';
import { useContact, useContacts, useLeadStats } from '@/features/leads/queries';
import { CONTACT_STATUSES, type ContactStatus } from '@/features/leads/types';
import { cn } from '@/lib/utils';
import { isDemo } from '@/lib/demo';
import { DEMO_REFERENCE_DATE } from '@/lib/demo/fixture-utils';

/**
 * Route composition only: the filters, the open contact, and the export. Data access is
 * `features/leads`; the markup below the header is components taking props.
 */

const PAGE_SIZE = 25;

export default function LeadsPage() {
  const websiteId = usePathSegment(1) ?? '';
  const [confirm, confirmDialog] = useConfirm();
  // Sample data is dated against a fixed clock; relative times read against it too.
  const now = isDemo(websiteId) ? DEMO_REFERENCE_DATE.getTime() : undefined;

  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ContactStatus | 'all'>('all');
  const [offset, setOffset] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const filters = { search: search.trim(), status: status === 'all' ? '' as const : status, limit: PAGE_SIZE, offset };
  const { data, isLoading, error } = useContacts(websiteId, filters);
  const stats = useLeadStats(websiteId);
  const detail = useContact(websiteId, openId);
  const setStatusMutation = useSetContactStatus(websiteId);
  const deleteMutation = useDeleteContact(websiteId);

  const exportCsv = async () => {
    setExportError(null);
    try {
      const url = URL.createObjectURL(await leadsApi.exportCsv(websiteId));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'contacts.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setExportError('Could not export contacts. Please try again.');
    }
  };

  const remove = async (contactId: string, email: string) => {
    const ok = await confirm({
      title: 'Delete this contact?',
      description: `${email} and all of their submissions will be permanently erased.`,
      confirmLabel: 'Delete contact',
      destructive: true,
    });
    if (!ok) return;
    await deleteMutation.mutateAsync(contactId);
    setOpenId(null);
  };

  if (openId) {
    return (
      <div className="w-full max-w-[1440px] mx-auto p-4 md:p-5 lg:px-6 lg:py-5">
        <Button variant="ghost" size="sm" onClick={() => setOpenId(null)} className="-ml-2 h-8 gap-1 px-2">
          <ChevronLeft className="h-4 w-4" /> All contacts
        </Button>
        {detail.isLoading || !detail.data ? (
          <div className="mt-3 h-40 animate-pulse rounded-xl bg-muted/50" />
        ) : (
          <ContactDetail
            className="mt-3"
            contact={detail.data.contact}
            submissions={detail.data.submissions}
            isUpdating={setStatusMutation.isPending}
            now={now}
            onSetStatus={(next) => setStatusMutation.mutate({ contactId: openId, status: next })}
            onDelete={() => void remove(openId, detail.data!.contact.email)}
          />
        )}
        {confirmDialog}
      </div>
    );
  }

  const list = data?.contacts ?? [];
  return (
    <div className="w-full max-w-[1440px] mx-auto p-4 md:p-5 lg:px-6 lg:py-5">
      <DashboardPageHeader
        title="Leads"
        description="People who submitted a form in one of your popups."
        websiteId={websiteId}
      >
        <Button variant="ghost" size="sm" className={cn(GHOST_CONTROL, 'h-8 gap-2 px-3 text-xs')} onClick={() => void exportCsv()}>
          <Download className="h-3.5 w-3.5" /> Export CSV
        </Button>
      </DashboardPageHeader>

      <StatCards
        isLoading={stats.isLoading}
        cards={[
          { label: 'Contacts', value: stats.data?.total ?? 0, icon: Users, tone: 'accent' },
          { label: 'New in 7 days', value: stats.data?.last_7_days ?? 0, icon: UserPlus, tone: 'success' },
          {
            label: 'Top popup',
            value: stats.data?.by_automation[0]?.name ?? '—',
            icon: Search,
          },
        ]}
      />

      {(error || exportError) && (
        <Alert variant="destructive" className="mb-4">
          <AlertDescription>{exportError ?? (error as Error).message}</AlertDescription>
        </Alert>
      )}

      <ContactList
        contacts={list}
        total={data?.total ?? 0}
        offset={offset}
        limit={PAGE_SIZE}
        isLoading={isLoading}
        now={now}
        filtered={!!filters.search || !!filters.status}
        onOpen={setOpenId}
        onPage={setOffset}
        toolbarLeft={<span className="text-sm font-medium">Contacts</span>}
        toolbarRight={
          <>
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
              placeholder="Search email or name"
              aria-label="Search contacts"
              className="h-8 w-48 text-xs"
            />
            <Select value={status} onValueChange={(v) => { setStatus(v as ContactStatus | 'all'); setOffset(0); }}>
              <SelectTrigger className={cn(GHOST_CONTROL, 'h-8 w-auto gap-2 px-3 text-xs')}><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All statuses</SelectItem>
                {CONTACT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="text-xs capitalize">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        }
      />
      {confirmDialog}
    </div>
  );
}
