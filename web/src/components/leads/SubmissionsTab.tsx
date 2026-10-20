'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Inbox, PlayCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  CollectionEmpty, CollectionPager, CollectionSkeleton, CollectionTable, FilterToolbar,
  type CollectionColumn, type FilterField,
} from '@/components/ui/collection';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { relativeTime } from '@/features/errors/format';
import { useDeleteSiteSubmission } from '@/features/leads/mutations';
import { useLeadForms, useSiteSubmissions } from '@/features/leads/queries';
import { formLabel, type SiteSubmission, type SiteSubmissionFilters } from '@/features/leads/types';
import { cameFrom, SUBMISSION_RANGES } from './lead-format';
import { SentTo } from './parts';

const PAGE_SIZE = 50;
const DAY = 86_400_000;
/** Submissions are kept 90 days, so removing the date filter shows them all. */
const KEPT_DAYS = 90;

export type SubmissionListFilters = Omit<SiteSubmissionFilters, 'limit' | 'offset'>;

/**
 * Every form's submissions, newest first: who, from which form, where they came from, where
 * the submission was sent, and the recording of the visit. A row opens its contact.
 */
export function SubmissionsTab({
  websiteId, now, canEdit, onOpenContact, onFiltersChange,
}: {
  websiteId: string;
  /** The demo's fixed clock; real sites use the browser's. */
  now?: number;
  canEdit: boolean;
  onOpenContact: (contactId: string) => void;
  /** Reports the current filters, so the page's Export can send the same ones. */
  onFiltersChange?: (filters: SubmissionListFilters) => void;
}) {
  const [confirm, confirmDialog] = useConfirm();
  const [search, setSearch] = useState('');
  const [form, setForm] = useState('');
  /** The date filter, in days; '' when removed. */
  const [range, setRange] = useState('30');
  const days = range ? Number(range) : KEPT_DAYS;
  const [page, setPage] = useState(0);

  // Fixed per range choice: a `from` recomputed every render would be a new query each time.
  const from = useMemo(() => new Date((now ?? Date.now()) - days * DAY).toISOString(), [days, now]);
  const listFilters: SubmissionListFilters = { search: search.trim(), form, from, to: '' };
  const filters: SiteSubmissionFilters = { ...listFilters, limit: PAGE_SIZE, offset: page * PAGE_SIZE };
  const list = useSiteSubmissions(websiteId, filters);
  const forms = useLeadForms(websiteId);
  const remove = useDeleteSiteSubmission(websiteId);

  const filtersKey = JSON.stringify(listFilters);
  useEffect(() => { onFiltersChange?.(JSON.parse(filtersKey)); }, [filtersKey, onFiltersChange]);

  const total = list.data?.total ?? 0;
  const narrowed = !!(search.trim() || form);
  useEffect(() => { setPage(0); }, [filtersKey]);

  const fields: FilterField[] = [
    {
      id: 'form', label: 'Form', value: form, onChange: setForm,
      options: (forms.data ?? []).map((f) => ({ value: f.id, label: `${f.name} · ${f.count}` })),
    },
    {
      id: 'date', label: 'Date', op: 'is', value: range, onChange: setRange,
      options: SUBMISSION_RANGES.map((r) => ({ value: String(r.days), label: r.label })),
    },
  ];

  const columns: CollectionColumn<SiteSubmission>[] = [
    {
      id: 'contact', header: 'Contact', width: '26%',
      cell: (s) => {
        const sub = [s.name, s.phone].filter(Boolean).join(' · ');
        return (
          <span className="block min-w-0">
            <span className="block truncate font-medium text-foreground" title={s.email}>{s.email}</span>
            <span className="block truncate text-xs text-muted-foreground">{sub || (s.consent ? 'Consented' : 'No name given')}</span>
          </span>
        );
      },
    },
    {
      id: 'form', header: 'Form', width: '20%',
      cell: (s) => {
        const f = formLabel(s);
        return <span className={f.known ? 'text-foreground/80' : 'text-muted-foreground'} title={s.form_name ?? undefined}>{f.text}</span>;
      },
    },
    { id: 'came_from', header: 'Came from', width: '16%', cell: (s) => <span className="text-foreground/80">{cameFrom(s.channel, s.utm_campaign)}</span> },
    { id: 'sent_to', header: 'Sent to', cell: (s) => <span className="block overflow-hidden text-xs [&>span]:flex-nowrap"><SentTo deliveries={s.deliveries} /></span> },
    {
      id: 'when', header: 'When', width: '96px', align: 'right', sorted: true,
      cell: (s) => (
        <time className="whitespace-nowrap text-xs text-muted-foreground" dateTime={s.created_at} title={new Date(s.created_at).toLocaleString()}>
          {relativeTime(s.created_at, now)}
        </time>
      ),
    },
    {
      id: 'actions', header: <span className="sr-only">Actions</span>, width: canEdit ? '120px' : '84px', align: 'right',
      cell: (s) => (
        <span className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {s.has_replay && s.session_id ? (
            <Button asChild variant="ghost" size="sm" className="h-7 w-[72px] gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground">
              <Link href={`/websites/${websiteId}/replays/${s.session_id}`}><PlayCircle className="h-3.5 w-3.5" />Watch</Link>
            </Button>
          ) : (
            // Keeps the delete buttons in one column whether or not there is a recording.
            <span className="w-[72px]" aria-hidden />
          )}
          {canEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              aria-label={`Delete submission from ${s.email}`}
              onClick={async () => {
                const ok = await confirm({
                  title: 'Delete this submission?',
                  description: `${s.email}'s answers to “${s.form_name ?? 'a deleted form'}” are removed. Their contact stays, and anything already sent to a destination stays there.`,
                  confirmLabel: 'Delete',
                  destructive: true,
                });
                if (!ok) return;
                remove.mutate(s.id, { onError: () => toast.error('Could not delete the submission. Please try again.') });
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </span>
      ),
    },
  ];

  const submissions = list.data?.submissions ?? [];

  return (
    <>
      {confirmDialog}
      <FilterToolbar
        filters={fields}
        search={{ value: search, onChange: setSearch, placeholder: 'Search email, name or phone…', label: 'Search submissions' }}
        count={list.data ? `${total.toLocaleString()} ${total === 1 ? 'submission' : 'submissions'}` : undefined}
      />
      {list.isLoading ? <CollectionSkeleton /> : submissions.length === 0 ? (
        <CollectionEmpty
          icon={<Inbox />}
          title={narrowed ? 'No matches' : 'No submissions yet'}
          description={narrowed
            ? 'No submission matches that search or form in this date range.'
            : 'Add a popup with a form to start collecting leads. Submissions are kept for 90 days; their contacts are kept until you delete them.'}
          action={!narrowed ? <Button asChild size="sm" variant="outline"><Link href={`/websites/${websiteId}/automations`}>Go to automations</Link></Button> : undefined}
        />
      ) : (
        <CollectionTable
          label="Submissions"
          items={submissions}
          getKey={(s) => s.id}
          columns={columns}
          minWidth={980}
          onOpen={(s) => s.contact_id && onOpenContact(s.contact_id)}
        />
      )}
      <CollectionPager page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} />
    </>
  );
}
