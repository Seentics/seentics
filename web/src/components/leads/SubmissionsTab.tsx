'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Inbox, PlayCircle, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { GHOST_CONTROL } from '@/components/ui/ghost-control';
import { Input } from '@/components/ui/input';
import { RangeSelect } from '@/components/ui/range-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { relativeTime } from '@/features/errors/format';
import { useDeleteSiteSubmission } from '@/features/leads/mutations';
import { useLeadForms, useSiteSubmissions } from '@/features/leads/queries';
import { formLabel, type SiteSubmission, type SiteSubmissionFilters } from '@/features/leads/types';
import { cn } from '@/lib/utils';
import { cameFrom, SUBMISSION_RANGES } from './lead-format';
import { SentTo } from './parts';

const PAGE_SIZE = 25;
const DAY = 86_400_000;
const ALL_FORMS = '__all__';

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
  const [days, setDays] = useState(30);
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

  const columns = useMemo<ColumnDef<SiteSubmission>[]>(() => [
    {
      id: 'when',
      header: 'When',
      cell: ({ row }) => (
        <time className="whitespace-nowrap text-xs text-muted-foreground" dateTime={row.original.created_at} title={new Date(row.original.created_at).toLocaleString()}>
          {relativeTime(row.original.created_at, now)}
        </time>
      ),
    },
    {
      id: 'contact',
      header: 'Contact',
      cell: ({ row }) => {
        const s = row.original;
        const sub = [s.name, s.phone].filter(Boolean).join(' · ');
        return (
          <div className="min-w-[180px] max-w-[260px]">
            <p className="truncate text-[13px] font-medium text-foreground" title={s.email}>{s.email}</p>
            <p className="truncate text-xs text-muted-foreground">{sub || (s.consent ? 'Consented' : 'No name given')}</p>
          </div>
        );
      },
    },
    {
      id: 'form',
      header: 'Form',
      cell: ({ row }) => {
        const form = formLabel(row.original);
        return (
          <span className="block max-w-[200px] truncate text-[13px] text-foreground/80" title={row.original.form_name ?? undefined}>
            {form.known ? form.text : <span className="text-muted-foreground">{form.text}</span>}
          </span>
        );
      },
    },
    {
      id: 'came_from',
      header: 'Came from',
      cell: ({ row }) => <span className="whitespace-nowrap text-[13px] text-foreground/80">{cameFrom(row.original.channel, row.original.utm_campaign)}</span>,
    },
    {
      id: 'sent_to',
      header: 'Sent to',
      cell: ({ row }) => <span className="text-xs"><SentTo deliveries={row.original.deliveries} /></span>,
    },
    {
      id: 'actions',
      header: () => <span className="sr-only">Actions</span>,
      cell: ({ row }) => {
        const s = row.original;
        return (
          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
            {s.has_replay && s.session_id ? (
              <Button asChild variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground">
                <Link href={`/websites/${websiteId}/replays/${s.session_id}`}><PlayCircle className="h-3.5 w-3.5" />Watch</Link>
              </Button>
            ) : (
              <span className="w-[68px]" aria-hidden />
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
          </div>
        );
      },
    },
  ], [canEdit, confirm, now, remove, websiteId]);

  return (
    <>
      {confirmDialog}
      <DataTable
        columns={columns}
        data={list.data?.submissions ?? []}
        isLoading={list.isLoading}
        paginationMode="server"
        pageSize={PAGE_SIZE}
        pageIndex={page}
        pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))}
        totalRowCount={total}
        onPaginationChange={(p) => setPage(p.pageIndex)}
        pageSizeOptions={[PAGE_SIZE]}
        onRowClick={(s) => s.contact_id && onOpenContact(s.contact_id)}
        rowClassName={(s) => (s.contact_id ? 'cursor-pointer' : undefined)}
        toolbarLeft={
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search email, name or phone…"
              className="h-8 !bg-card pl-8 text-xs"
              aria-label="Search submissions"
            />
          </div>
        }
        toolbarRight={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <Select value={form || ALL_FORMS} onValueChange={(v) => { setForm(v === ALL_FORMS ? '' : v); setPage(0); }}>
              <SelectTrigger className={cn(GHOST_CONTROL, 'h-8 w-auto max-w-[220px] gap-2 px-3 text-xs')} aria-label="Form"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_FORMS} className="text-xs">All forms</SelectItem>
                {(forms.data ?? []).map((f) => (
                  <SelectItem key={f.id} value={f.id} className="text-xs">{f.name} <span className="text-muted-foreground">· {f.count}</span></SelectItem>
                ))}
              </SelectContent>
            </Select>
            <RangeSelect value={days} onChange={(d) => { setDays(d); setPage(0); }} ranges={SUBMISSION_RANGES} />
          </div>
        }
        emptyIcon={<Inbox className="h-6 w-6" />}
        emptyTitle={narrowed ? 'No matches' : 'No submissions yet'}
        emptyDescription={
          narrowed
            ? 'No submission matches that search or form in this date range.'
            : 'Add a popup with a form to start collecting leads. Submissions are kept for 90 days; their contacts are kept until you delete them.'
        }
        emptyAction={!narrowed ? (
          <Button asChild size="sm" variant="outline"><Link href={`/websites/${websiteId}/automations`}>Go to automations</Link></Button>
        ) : undefined}
      />
    </>
  );
}
