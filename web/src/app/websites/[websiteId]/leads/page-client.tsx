'use client';

import { usePathSegment, useIsPathOverridden } from '@/lib/path-segment';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, Plus, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { AiModeButton } from '@/components/ai/AiModeButton';
import { Button } from '@/components/ui/button';
import { CountTabs } from '@/components/ui/collection';
import { LIST_PAGE, PageBar } from '@/components/ui/linear-list';
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
import { useT } from '@/lib/i18n';

/** The heading's secondary actions (Export, Import): outlined, as tall as the primary button beside them. */
const HEADER_BUTTON = 'inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-card px-3 text-[13px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50';

/**
 * Route composition only: which tab, which contact is open, the dialogs, and export. Each tab,
 * the drawer and the dialogs are components under `components/leads`; data lives in
 * `features/leads`.
 *
 * Laid out like the other list pages: the heading with the page's actions, then each tab's list
 * with the two tabs and its controls as the list's top row (see `components/ui/collection`).
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
  const t = useT().leads.page;
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
  /** The two tabs, on the left of whichever tab's toolbar is open. */
  const tabs = (
    <CountTabs
      label={t.title}
      tabs={[
        { id: 'contacts' as const, label: t.people, count: everyone.data?.total },
        { id: 'submissions' as const, label: t.submissions, count: recent.data?.total },
      ]}
      value={tab}
      onChange={go}
    />
  );

  const exportCsv = async () => {
    setExporting(true);
    try {
      const blob = tab === 'contacts'
        ? await leadsApi.exportContacts(websiteId, contactFilters ?? { search: '', status: '', tag: '', source: '', sort: 'last_activity' })
        : await leadsApi.exportSubmissions(websiteId, submissionFilters ?? { search: '', form: '', from: '', to: '' });
      downloadBlob(blob, tab === 'contacts' ? 'contacts.csv' : 'submissions.csv');
    } catch {
      toast.error(t.exportFailed);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className={LIST_PAGE}>
      <PageBar title={t.title} description={t.description}>
        <button type="button" className={HEADER_BUTTON} onClick={exportCsv} disabled={exporting}>
          <Download className="size-3.5" />{t.export}
        </button>
        {tab === 'contacts' && canEdit && (
          <>
            <button type="button" className={HEADER_BUTTON} onClick={() => setImporting(true)}>
              <Upload className="size-3.5" />{t.import}
            </button>
            <Button className="h-8 gap-1.5 px-3 text-[13px]" onClick={() => setAdding(true)}>
              <Plus className="size-3.5" />{t.addContact}
            </Button>
          </>
        )}
        <AiModeButton websiteId={websiteId} className="h-8" />
      </PageBar>

      {tab === 'submissions' ? (
        <SubmissionsTab websiteId={websiteId} now={now} canEdit={canEdit} onOpenContact={openContact} onFiltersChange={setSubmissionFilters} tabs={tabs} />
      ) : (
        <ContactsTab
          websiteId={websiteId}
          now={now}
          canEdit={canEdit}
          onOpenContact={openContact}
          onAdd={() => setAdding(true)}
          onImport={() => setImporting(true)}
          onFiltersChange={setContactFilters}
          tabs={tabs}
        />
      )}

      <ContactDrawer websiteId={websiteId} contactId={contactId} now={now} canEdit={canEdit} onClose={() => openContact(null)} />
      <AddContactDialog websiteId={websiteId} open={adding} onOpenChange={setAdding} onOpenContact={openContact} />
      <ImportContactsDialog websiteId={websiteId} open={importing} onOpenChange={setImporting} />
    </div>
  );
}
