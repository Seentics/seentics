'use client';

import { usePathSegment, useIsPathOverridden } from '@/lib/path-segment';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Plus, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { StatCards } from '@/components/seentics-ui/StatCards';
import { Button } from '@/components/ui/button';
import { GHOST_CONTROL } from '@/components/ui/ghost-control';
import { usePermissions } from '@/hooks/use-permissions';
import { AddContactDialog } from '@/components/leads/AddContactDialog';
import { ContactDrawer } from '@/components/leads/ContactDrawer';
import { ContactsTab, type ContactListFilters } from '@/components/leads/ContactsTab';
import { ImportContactsDialog } from '@/components/leads/ImportContactsDialog';
import { downloadBlob } from '@/components/leads/lead-format';
import { SubmissionsTab, type SubmissionListFilters } from '@/components/leads/SubmissionsTab';
import { leadsApi } from '@/features/leads/api';
import { useContacts, useSiteSubmissions } from '@/features/leads/queries';
import { isDemo } from '@/lib/demo';
import { DEMO_REFERENCE_DATE } from '@/lib/demo/fixture-utils';
import { cn } from '@/lib/utils';

/**
 * Route composition only: which tab, which contact is open, the dialogs, and export. Each tab,
 * the drawer and the dialogs are components under `components/leads`; data lives in
 * `features/leads`.
 *
 * Two views of the same people. Submissions are every form's entries, kept for 90 days;
 * contacts are the people behind them, kept until deleted, and can also be added by hand or
 * imported. The tab and the open contact live in the query string, read from `window.location`
 * after mount (as the agency page does) so a reload or a shared link lands on them.
 */

type Tab = 'submissions' | 'contacts';
const DAY = 86_400_000;

function writeUrl(tab: Tab, contact: string | null) {
  const params = new URLSearchParams();
  if (tab === 'contacts') params.set('tab', 'contacts');
  if (contact) params.set('contact', contact);
  const qs = params.toString();
  window.history.replaceState(null, '', `${window.location.pathname}${qs ? `?${qs}` : ''}`);
}

export default function LeadsPage() {
  const websiteId = usePathSegment(1) ?? '';
  // In the landing page's preview the URL is the landing page's: tab and contact stay in memory.
  const embedded = useIsPathOverridden();
  const demo = isDemo(websiteId);
  const now = demo ? DEMO_REFERENCE_DATE.getTime() : undefined;
  const { canEdit: canEditRole } = usePermissions(websiteId);
  // The demo shows every control; its writes answer with the demo notice instead of saving.
  const canEdit = canEditRole || demo;

  const [tab, setTab] = useState<Tab>('submissions');
  const [contactId, setContactId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [submissionFilters, setSubmissionFilters] = useState<SubmissionListFilters | null>(null);
  const [contactFilters, setContactFilters] = useState<ContactListFilters | null>(null);

  useEffect(() => {
    if (embedded) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') === 'contacts') setTab('contacts');
    const contact = params.get('contact');
    if (contact) setContactId(contact);
  }, [embedded]);

  const go = (next: Tab) => { setTab(next); if (!embedded) writeUrl(next, contactId); };
  const openContact = useCallback((id: string | null) => {
    setContactId(id);
    if (!embedded) writeUrl(new URLSearchParams(window.location.search).get('tab') === 'contacts' ? 'contacts' : 'submissions', id);
  }, [embedded]);

  // The summary: plain counts, from the same endpoints the tabs use (one row each, just the totals).
  const monthAgo = useMemo(() => new Date((now ?? Date.now()) - 30 * DAY).toISOString(), [now]);
  const recent = useSiteSubmissions(websiteId, { search: '', form: '', from: monthAgo, to: '', limit: 1, offset: 0 });
  const everyone = useContacts(websiteId, { search: '', status: '', tag: '', source: '', sort: 'last_activity', limit: 1, offset: 0 });
  const statuses = everyone.data?.statuses;
  const figure = (n: number | undefined) => (n === undefined ? '—' : n.toLocaleString());

  const exportCsv = async () => {
    setExporting(true);
    try {
      const blob = tab === 'contacts'
        ? await leadsApi.exportContacts(websiteId, contactFilters ?? { search: '', status: '', tag: '', source: '', sort: 'last_activity' })
        : await leadsApi.exportSubmissions(websiteId, submissionFilters ?? { search: '', form: '', from: '', to: '' });
      downloadBlob(blob, tab === 'contacts' ? 'contacts.csv' : 'submissions.csv');
    } catch {
      toast.error('Could not export. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1440px] p-4 md:p-5 lg:px-6 lg:py-5">
      <DashboardPageHeader title="Leads" description="Everyone who filled in a form, and the contacts they became." websiteId={websiteId}>
        <Button variant="ghost" className={cn(GHOST_CONTROL, 'h-8 gap-1.5 px-3 text-xs')} onClick={exportCsv} disabled={exporting}>
          <Download className="h-3.5 w-3.5" />Export CSV
        </Button>
        {tab === 'contacts' && canEdit && (
          <>
            <Button variant="ghost" className={cn(GHOST_CONTROL, 'h-8 gap-1.5 px-3 text-xs')} onClick={() => setImporting(true)}>
              <Upload className="h-3.5 w-3.5" />Import
            </Button>
            <Button className="h-8 gap-1.5 px-3 text-xs" onClick={() => setAdding(true)}>
              <Plus className="h-3.5 w-3.5" />Add contact
            </Button>
          </>
        )}
      </DashboardPageHeader>

      <StatCards
        className="mb-5"
        cards={[
          { label: 'Submissions', value: figure(recent.data?.total), subtext: 'Last 30 days' },
          { label: 'Contacts', value: figure(everyone.data?.total), subtext: 'Kept until deleted' },
          { label: 'New', value: figure(statuses?.new), subtext: 'Not contacted yet' },
          { label: 'Customers', value: figure(statuses?.customer) },
        ]}
      />

      <div role="tablist" aria-label="Leads" className="mb-4 flex gap-5 border-b border-border">
        {(['submissions', 'contacts'] as const).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => go(t)}
            className={cn(
              '-mb-px border-b-2 px-0.5 pb-2.5 text-[13px] font-medium transition-colors',
              tab === t ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {t === 'submissions' ? 'Submissions' : 'Contacts'}
            {t === 'contacts' && everyone.data && <span className="ml-1.5 tabular-nums text-muted-foreground">{everyone.data.total}</span>}
          </button>
        ))}
      </div>

      {tab === 'submissions' ? (
        <SubmissionsTab websiteId={websiteId} now={now} canEdit={canEdit} onOpenContact={openContact} onFiltersChange={setSubmissionFilters} />
      ) : (
        <ContactsTab
          websiteId={websiteId}
          now={now}
          canEdit={canEdit}
          onOpenContact={openContact}
          onAdd={() => setAdding(true)}
          onImport={() => setImporting(true)}
          onFiltersChange={setContactFilters}
        />
      )}

      <ContactDrawer websiteId={websiteId} contactId={contactId} now={now} canEdit={canEdit} onClose={() => openContact(null)} />
      <AddContactDialog websiteId={websiteId} open={adding} onOpenChange={setAdding} onOpenContact={openContact} />
      <ImportContactsDialog websiteId={websiteId} open={importing} onOpenChange={setImporting} />
    </div>
  );
}
