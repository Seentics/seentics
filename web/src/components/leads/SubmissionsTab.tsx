'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Inbox, PlayCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  COLLECTION_SURFACE, CollectionEmpty, CollectionPager, CollectionSkeleton, CollectionTable, FilterToolbar,
  type CollectionColumn, type FilterField,
} from '@/components/ui/collection';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { relativeTime } from '@/features/errors/format';
import { useRetryDelivery } from '@/features/integrations/mutations';
import { useDeleteSiteSubmission } from '@/features/leads/mutations';
import { useLeadForms, useSiteSubmissions } from '@/features/leads/queries';
import { formLabel, type SiteSubmission, type SiteSubmissionFilters } from '@/features/leads/types';
import { useLocale, useT } from '@/lib/i18n';
import { SUBMISSION_RANGES } from './lead-format';
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
  websiteId, now, canEdit, onOpenContact, onFiltersChange, tabs, delivery,
}: {
  websiteId: string;
  /** The demo's fixed clock; real sites use the browser's. */
  now?: number;
  canEdit: boolean;
  onOpenContact: (contactId: string) => void;
  /** Reports the current filters, so the page's Export can send the same ones. */
  onFiltersChange?: (filters: SubmissionListFilters) => void;
  /** The page's tabs (People / Submissions), on the left of this tab's toolbar. */
  tabs?: ReactNode;
  /** The Failed to send tab: only submissions an integration did not take. */
  delivery?: 'failed';
}) {
  const all = useT();
  const retry = useRetryDelivery(websiteId);
  const onRetry = canEdit ? (d: { id: string }) => retry.mutate(d.id, {
    onSuccess: () => toast.success(all.leads.destinations.retried),
    onError: () => toast.error(all.leads.destinations.retryFailed),
  }) : undefined;
  const t = all.leads;
  const ts = t.submissions;
  const { locale } = useLocale();
  const [confirm, confirmDialog] = useConfirm();
  const [search, setSearch] = useState('');
  const [form, setForm] = useState('');
  /** The date filter, in days; '' when removed. */
  const [range, setRange] = useState('30');
  const days = range ? Number(range) : KEPT_DAYS;
  const [page, setPage] = useState(0);

  // Fixed per range choice: a `from` recomputed every render would be a new query each time.
  const from = useMemo(() => new Date((now ?? Date.now()) - days * DAY).toISOString(), [days, now]);
  const listFilters: SubmissionListFilters = { search: search.trim(), form, from, to: '', ...(delivery ? { delivery } : {}) };
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
      id: 'form', label: ts.form, value: form, onChange: setForm,
      options: (forms.data ?? []).map((f) => ({ value: f.id, label: `${f.name} · ${f.count}` })),
    },
    {
      id: 'date', label: ts.date, op: 'is', value: range, onChange: setRange,
      options: SUBMISSION_RANGES.map((d) => ({ value: String(d), label: t.ranges[d] })),
    },
  ];

  const columns: CollectionColumn<SiteSubmission>[] = [
    {
      id: 'contact', header: ts.contact, width: '30%',
      cell: (s) => {
        const sub = [s.name, s.phone].filter(Boolean).join(' · ');
        return (
          // The sender's initial in a tile, as the People table shows an avatar.
          <span className="flex min-w-0 items-center gap-2.5">
            <span aria-hidden className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-[12px] font-semibold uppercase text-muted-foreground">{(s.name || s.email || '?').slice(0, 1)}</span>
            <span className="block min-w-0">
              <span className="block truncate font-medium text-foreground" title={s.email}>{s.email}</span>
              <span className="block truncate text-xs text-muted-foreground">{sub || (s.consent ? ts.consented : ts.noName)}</span>
            </span>
          </span>
        );
      },
    },
    {
      id: 'form', header: ts.form, width: '20%',
      cell: (s) => {
        const f = formLabel(s, t.form);
        return <span className={f.known ? 'text-foreground/80' : 'text-muted-foreground'} title={s.form_name ?? undefined}>{f.text}</span>;
      },
    },
    { id: 'sent_to', header: ts.sentTo, cell: (s) => <span className="block overflow-hidden text-xs [&>span]:flex-nowrap"><SentTo deliveries={s.deliveries} onRetry={onRetry} retrying={retry.isPending} /></span> },
    {
      id: 'when', header: ts.when, width: '96px', align: 'right', sorted: true,
      cell: (s) => (
        <time className="whitespace-nowrap text-xs text-muted-foreground" dateTime={s.created_at} title={new Date(s.created_at).toLocaleString(locale === 'bn' ? 'bn-BD-u-nu-latn' : undefined)}>
          {relativeTime(s.created_at, now, all.errors.time)}
        </time>
      ),
    },
    {
      id: 'actions', header: <span className="sr-only">{all.actions.actions}</span>, width: canEdit ? '120px' : '84px', align: 'right',
      cell: (s) => (
        <span className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {s.has_replay && s.session_id ? (
            <Button asChild variant="ghost" size="sm" className="h-7 w-[72px] gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground">
              <Link href={`/websites/${websiteId}/replays/${s.session_id}`}><PlayCircle className="h-3.5 w-3.5" />{ts.watch}</Link>
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
              aria-label={ts.deleteFrom(s.email)}
              onClick={async () => {
                const ok = await confirm({
                  title: ts.deleteTitle,
                  description: ts.deleteBody(s.email, s.form_name),
                  confirmLabel: all.actions.delete,
                  destructive: true,
                });
                if (!ok) return;
                remove.mutate(s.id, { onError: () => toast.error(ts.deleteFailed) });
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
  /** The panel's top row: the page's tabs on the left, this list's controls on the right. */
  const toolbar = (
    <FilterToolbar
      leading={tabs}
      filters={fields}
      search={{ value: search, onChange: setSearch, placeholder: ts.searchPlaceholder, label: ts.searchLabel }}
      count={tabs ? undefined : list.data ? ts.count(total, total.toLocaleString()) : undefined}
    />
  );

  return (
    <>
      {confirmDialog}
      {list.isLoading ? <div className={COLLECTION_SURFACE}>{toolbar}<CollectionSkeleton /></div> : submissions.length === 0 ? (
        <div className={COLLECTION_SURFACE}>{toolbar}<CollectionEmpty
          icon={<Inbox />}
          title={narrowed ? ts.noMatches : ts.empty}
          description={narrowed ? ts.noMatchBody : ts.emptyBody}
          action={!narrowed ? <Button asChild size="sm" variant="outline"><Link href={`/websites/${websiteId}/automations`}>{ts.goToAutomations}</Link></Button> : undefined}
        /></div>
      ) : (
        <CollectionTable
          toolbar={toolbar}
          label={ts.tableLabel}
          items={submissions}
          getKey={(s) => s.id}
          columns={columns}
          minWidth={820}
          rowClassName="h-14"
          onOpen={(s) => s.contact_id && onOpenContact(s.contact_id)}
        />
      )}
      <CollectionPager page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} />
    </>
  );
}
