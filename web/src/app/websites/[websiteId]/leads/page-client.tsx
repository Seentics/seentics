'use client';

import { usePathSegment, useIsPathOverridden } from '@/lib/path-segment';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Contact, Download, Plus, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { AiModeButton } from '@/components/ai/AiModeButton';
import { Button } from '@/components/ui/button';
import { GHOST_BUTTON, LIST_PAGE, PageBar, ViewTabs } from '@/components/ui/linear-list';
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

/**
 * Route composition only: which tab, which contact is open, the dialogs, and export. Each tab,
 * the drawer and the dialogs are components under `components/leads`; data lives in
 * `features/leads`.
 *
 * Laid out like the other list pages: a top bar with the two tabs and the page's actions, then
 * each tab's toolbar and layouts (see `components/ui/collection`).
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
  if (tab === 'submissions') params.set('tab', 'submissions');
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

  const [tab, setTab] = useState<Tab>('contacts');
  const [contactId, setContactId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [submissionFilters, setSubmissionFilters] = useState<SubmissionListFilters | null>(null);
  const [contactFilters, setContactFilters] = useState<ContactListFilters | null>(null);

  useEffect(() => {
    if (embedded) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') === 'submissions') setTab('submissions');
    const contact = params.get('contact');
    if (contact) setContactId(contact);
  }, [embedded]);

  const go = (next: Tab) => { setTab(next); if (!embedded) writeUrl(next, contactId); };
  const openContact = useCallback((id: string | null) => {
    setContactId(id);
    if (!embedded) writeUrl(new URLSearchParams(window.location.search).get('tab') === 'submissions' ? 'submissions' : 'contacts', id);
  }, [embedded]);

  // The tab counts: one row each from the endpoints the tabs use, just the totals.
  const monthAgo = useMemo(() => new Date((now ?? Date.now()) - 30 * DAY).toISOString(), [now]);
  const recent = useSiteSubmissions(websiteId, { search: '', form: '', from: monthAgo, to: '', limit: 1, offset: 0 });
  const everyone = useContacts(websiteId, { search: '', status: '', tag: '', source: '', sort: 'last_activity', limit: 1, offset: 0 });
  const count = (n: number | undefined) => (n === undefined ? '' : ` ${n.toLocaleString()}`);

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
    <div className={LIST_PAGE}>
      <PageBar
        icon={<Contact />}
        title="Leads"
        views={
          <ViewTabs
            label="Leads"
            tabs={[
              { id: 'contacts', label: `People${count(everyone.data?.total)}` },
              { id: 'submissions', label: `Submissions${count(recent.data?.total)}` },
            ]}
            value={tab}
            onChange={go}
          />
        }
      >
        <button type="button" className={GHOST_BUTTON} onClick={exportCsv} disabled={exporting}>
          <Download className="size-3.5" />Export
        </button>
        {tab === 'contacts' && canEdit && (
          <>
            <button type="button" className={GHOST_BUTTON} onClick={() => setImporting(true)}>
              <Upload className="size-3.5" />Import
            </button>
            <Button className="h-7 gap-1.5 px-2.5 text-[12.5px]" onClick={() => setAdding(true)}>
              <Plus className="size-3.5" />Add contact
            </Button>
          </>
        )}
        <AiModeButton websiteId={websiteId} className="h-7" />
      </PageBar>

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
