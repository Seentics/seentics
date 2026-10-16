'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Tag, Trash2, Upload, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { DataTable, type ColumnDef } from '@/components/ui/data-table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { GHOST_CONTROL } from '@/components/ui/ghost-control';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { relativeTime } from '@/features/errors/format';
import { useBulkUpdateContacts, useDeleteContacts, useUpdateContact } from '@/features/leads/mutations';
import { useContactTags, useContacts } from '@/features/leads/queries';
import { CONTACT_STATUSES, type Contact, type ContactFilters, type ContactSort, type ContactSource, type ContactStatus } from '@/features/leads/types';
import { cn } from '@/lib/utils';
import { cameFrom, SOURCE_LABEL, STATUS_META } from './lead-format';
import { StatusDot, StatusSelect, TagList } from './parts';

const PAGE_SIZE = 25;
const ANY = '__any__';

export type ContactListFilters = Omit<ContactFilters, 'limit' | 'offset'>;

/**
 * The people behind the leads, kept until deleted: status, tags and notes, how many forms they
 * filled in and where they first came from. Selecting rows offers status, tag and delete for
 * all of them at once. A row opens the contact.
 */
export function ContactsTab({
  websiteId, now, canEdit, onOpenContact, onAdd, onImport, onFiltersChange,
}: {
  websiteId: string;
  now?: number;
  canEdit: boolean;
  onOpenContact: (contactId: string) => void;
  onAdd: () => void;
  onImport: () => void;
  onFiltersChange?: (filters: ContactListFilters) => void;
}) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ContactStatus | ''>('');
  const [tag, setTag] = useState('');
  const [source, setSource] = useState<ContactSource | ''>('');
  const [sort, setSort] = useState<ContactSort>('last_activity');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Map<string, Contact>>(new Map());
  const [deleting, setDeleting] = useState(false);

  const listFilters: ContactListFilters = { search: search.trim(), status, tag, source, sort };
  const list = useContacts(websiteId, { ...listFilters, limit: PAGE_SIZE, offset: page * PAGE_SIZE });
  const update = useUpdateContact(websiteId);
  const bulk = useBulkUpdateContacts(websiteId);

  const filtersKey = JSON.stringify(listFilters);
  useEffect(() => { onFiltersChange?.(JSON.parse(filtersKey)); }, [filtersKey, onFiltersChange]);
  const narrowed = !!(search.trim() || status || tag || source);
  const statuses = list.data?.statuses;

  const contacts = list.data?.contacts ?? [];
  const total = list.data?.total ?? 0;
  // Tags offered in the filter: every tag in use on the site, and the one picked.
  const siteTags = useContactTags(websiteId).data;
  const tagOptions = useMemo(
    () => [...new Set([...(siteTags ?? []).map((t) => t.tag), ...contacts.flatMap((c) => c.tags), ...(tag ? [tag] : [])])].sort(),
    [siteTags, contacts, tag],
  );

  const resetPage = () => setPage(0);
  const toggle = (c: Contact, on: boolean) => setSelected((prev) => {
    const next = new Map(prev);
    if (on) next.set(c.id, c); else next.delete(c.id);
    return next;
  });
  const allOnPage = contacts.length > 0 && contacts.every((c) => selected.has(c.id));

  const columns = useMemo<ColumnDef<Contact>[]>(() => [
    ...(canEdit ? [{
      id: 'select',
      header: () => (
        <Checkbox
          aria-label="Select all on this page"
          checked={allOnPage}
          onCheckedChange={(on) => setSelected((prev) => {
            const next = new Map(prev);
            contacts.forEach((c) => (on ? next.set(c.id, c) : next.delete(c.id)));
            return next;
          })}
        />
      ),
      cell: ({ row }: { row: { original: Contact } }) => (
        <span onClick={(e) => e.stopPropagation()}>
          <Checkbox aria-label={`Select ${row.original.email}`} checked={selected.has(row.original.id)} onCheckedChange={(on) => toggle(row.original, !!on)} />
        </span>
      ),
    } satisfies ColumnDef<Contact>] : []),
    {
      id: 'contact',
      header: 'Contact',
      cell: ({ row }) => (
        <div className="min-w-[180px] max-w-[260px]">
          <p className="truncate text-[13px] font-medium text-foreground" title={row.original.email}>{row.original.email}</p>
          <p className="truncate text-xs text-muted-foreground">{[row.original.name, row.original.phone].filter(Boolean).join(' · ') || 'No name'}</p>
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <StatusSelect
          value={row.original.status}
          ariaLabel={`Status of ${row.original.email}`}
          onChange={canEdit ? (next) => update.mutate(
            { id: row.original.id, patch: { status: next } },
            { onError: () => toast.error('Could not change the status. Please try again.') },
          ) : undefined}
        />
      ),
    },
    { id: 'tags', header: 'Tags', cell: ({ row }) => <span className="text-xs"><TagList tags={row.original.tags} /></span> },
    { id: 'source', header: 'Source', cell: ({ row }) => <span className="whitespace-nowrap text-[13px] text-foreground/80">{SOURCE_LABEL[row.original.source]}</span> },
    {
      id: 'submissions',
      header: () => <span className="block text-right">Forms</span>,
      cell: ({ row }) => <span className="block text-right text-[13px] tabular-nums text-foreground/80">{row.original.submission_count}</span>,
    },
    { id: 'first', header: 'First came from', cell: ({ row }) => <span className="whitespace-nowrap text-[13px] text-foreground/80">{cameFrom(row.original.first_channel)}</span> },
    {
      id: 'last',
      header: 'Last activity',
      cell: ({ row }) => (
        <time className="whitespace-nowrap text-xs text-muted-foreground" dateTime={row.original.last_activity_at}>{relativeTime(row.original.last_activity_at, now)}</time>
      ),
    },
  ], [allOnPage, canEdit, contacts, now, selected, update]);

  const ids = [...selected.keys()];
  const applyBulk = (change: { status?: ContactStatus; add_tags?: string[] }, done: string) => bulk.mutate(
    { ids, ...change },
    { onSuccess: () => { toast.success(done); setSelected(new Map()); }, onError: () => toast.error('Could not update the contacts. Please try again.') },
  );

  return (
    <div className="space-y-3">
      {/* Status chips: the pipeline at a glance, and its quickest filter. */}
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by status">
        <Chip active={!status} onClick={() => { setStatus(''); resetPage(); }} label="All" count={statuses ? Object.values(statuses).reduce((a, b) => a + b, 0) : undefined} />
        {CONTACT_STATUSES.map((s) => (
          <Chip key={s} active={status === s} onClick={() => { setStatus(status === s ? '' : s); resetPage(); }} label={STATUS_META[s].label} count={statuses?.[s]} dot={<StatusDot status={s} />} />
        ))}
      </div>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm">
          <span className="font-medium">{selected.size} selected</span>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelected(new Map())}>Clear</Button>
          <span className="mx-1 h-4 w-px bg-border" aria-hidden />
          <Select onValueChange={(v) => applyBulk({ status: v as ContactStatus }, `Status set to ${STATUS_META[v as ContactStatus].label}`)}>
            <SelectTrigger className={cn(GHOST_CONTROL, 'h-7 w-auto gap-2 px-2.5 text-xs')} aria-label="Set status"><SelectValue placeholder="Set status" /></SelectTrigger>
            <SelectContent>
              {CONTACT_STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="text-xs"><span className="inline-flex items-center gap-2"><StatusDot status={s} />{STATUS_META[s].label}</span></SelectItem>
              ))}
            </SelectContent>
          </Select>
          <AddTagButton onAdd={(t) => applyBulk({ add_tags: [t] }, `Tagged ${selected.size} contact${selected.size === 1 ? '' : 's'} “${t}”`)} />
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-destructive hover:text-destructive" onClick={() => setDeleting(true)}>
            <Trash2 className="h-3.5 w-3.5" />Delete
          </Button>
        </div>
      )}

      <DataTable
        columns={columns}
        data={contacts}
        isLoading={list.isLoading}
        paginationMode="server"
        pageSize={PAGE_SIZE}
        pageIndex={page}
        pageCount={Math.max(1, Math.ceil(total / PAGE_SIZE))}
        totalRowCount={total}
        onPaginationChange={(p) => setPage(p.pageIndex)}
        pageSizeOptions={[PAGE_SIZE]}
        onRowClick={(c) => onOpenContact(c.id)}
        rowClassName={() => 'cursor-pointer'}
        toolbarLeft={
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={search} onChange={(e) => { setSearch(e.target.value); resetPage(); }} placeholder="Search email, name or phone…" className="h-8 !bg-card pl-8 text-xs" aria-label="Search contacts" />
          </div>
        }
        toolbarRight={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <Select value={tag || ANY} onValueChange={(v) => { setTag(v === ANY ? '' : v); resetPage(); }}>
              <SelectTrigger className={cn(GHOST_CONTROL, 'h-8 w-auto gap-2 px-3 text-xs')} aria-label="Tag"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY} className="text-xs">Any tag</SelectItem>
                {tagOptions.map((t) => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={source || ANY} onValueChange={(v) => { setSource(v === ANY ? '' : (v as ContactSource)); resetPage(); }}>
              <SelectTrigger className={cn(GHOST_CONTROL, 'h-8 w-auto gap-2 px-3 text-xs')} aria-label="Source"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ANY} className="text-xs">Any source</SelectItem>
                {(Object.keys(SOURCE_LABEL) as ContactSource[]).map((s) => <SelectItem key={s} value={s} className="text-xs">{SOURCE_LABEL[s]}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => { setSort(v as ContactSort); resetPage(); }}>
              <SelectTrigger className={cn(GHOST_CONTROL, 'h-8 w-auto gap-2 px-3 text-xs')} aria-label="Sort"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="last_activity" className="text-xs">Recent activity</SelectItem>
                <SelectItem value="created" className="text-xs">Newest contacts</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
        emptyIcon={<Users className="h-6 w-6" />}
        emptyTitle={narrowed ? 'No matches' : 'No contacts yet'}
        emptyDescription={
          narrowed
            ? 'No contact matches these filters.'
            : 'Contacts appear here when someone fills in a form. You can also add people by hand or import a spreadsheet.'
        }
        emptyAction={!narrowed && canEdit ? (
          <div className="flex justify-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={onImport}><Upload className="h-3.5 w-3.5" />Import CSV</Button>
            <Button size="sm" className="gap-1.5" onClick={onAdd}><Plus className="h-3.5 w-3.5" />Add contact</Button>
          </div>
        ) : undefined}
      />

      <DeleteContactsDialog
        websiteId={websiteId}
        open={deleting}
        contacts={[...selected.values()]}
        onOpenChange={setDeleting}
        onDeleted={() => setSelected(new Map())}
      />
    </div>
  );
}

function Chip({ active, onClick, label, count, dot }: { active: boolean; onClick: () => void; label: string; count?: number; dot?: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors',
        active ? 'border-foreground/20 bg-foreground/[0.06] text-foreground' : 'border-border text-muted-foreground hover:text-foreground',
      )}
    >
      {dot}{label}
      {count !== undefined && <span className="tabular-nums text-muted-foreground">{count}</span>}
    </button>
  );
}

function AddTagButton({ onAdd }: { onAdd: (tag: string) => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const submit = () => {
    const t = value.trim().toLowerCase();
    if (!t) return;
    onAdd(t);
    setValue('');
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs"><Tag className="h-3.5 w-3.5" />Add tag</Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-2" align="start">
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex gap-2">
          <Input autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder="Tag name" className="h-8 text-xs" aria-label="Tag name" />
          <Button type="submit" size="sm" className="h-8">Add</Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

/** Deleting contacts, with the choice to take their form submissions too (what a GDPR erasure needs). */
export function DeleteContactsDialog({
  websiteId, open, contacts, onOpenChange, onDeleted,
}: { websiteId: string; open: boolean; contacts: Contact[]; onOpenChange: (open: boolean) => void; onDeleted?: () => void }) {
  const [withSubmissions, setWithSubmissions] = useState(false);
  const remove = useDeleteContacts(websiteId);
  const n = contacts.length;
  const who = n === 1 ? contacts[0]!.email : `${n} contacts`;
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setWithSubmissions(false); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete {who}?</DialogTitle>
          <DialogDescription>
            Their status, tags and notes are removed. This cannot be undone. Anything already sent to Mailchimp, HubSpot or another destination stays there.
          </DialogDescription>
        </DialogHeader>
        <Label className="flex items-start gap-2.5 text-sm font-normal">
          <Checkbox checked={withSubmissions} onCheckedChange={(v) => setWithSubmissions(!!v)} className="mt-0.5" />
          <span>Also delete their form submissions<span className="block text-xs text-muted-foreground">Use this when someone asks for their data to be erased.</span></span>
        </Label>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => remove.mutate(
              { ids: contacts.map((c) => c.id), withSubmissions },
              {
                onSuccess: () => { toast.success(n === 1 ? 'Contact deleted' : `${n} contacts deleted`); onOpenChange(false); onDeleted?.(); },
                onError: () => toast.error('Could not delete. Please try again.'),
              },
            )}
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
