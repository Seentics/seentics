'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Tag, Trash2, Upload, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  BoardView, CARD, CollectionEmpty, CollectionPager, CollectionRow, CollectionSkeleton, CollectionTable,
  FilterToolbar, GroupedRows, LayoutSwitch, useLayoutPreference,
  type CollectionColumn, type CollectionGroup, type FilterField,
} from '@/components/ui/collection';
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

/** Rows per page in the list and the table. */
const PAGE_SIZE = 50;
/** The board shows one page of the most recent people: the most the API returns at once. */
const BOARD_SIZE = 100;

const LAYOUTS = ['list', 'table', 'board'] as const;
type ContactLayout = (typeof LAYOUTS)[number];

/** The list's groups, the ones to act on first; the board runs in pipeline order. */
const LIST_ORDER: ContactStatus[] = ['qualified', 'new', 'contacted', 'customer', 'lost'];

export type ContactListFilters = Omit<ContactFilters, 'limit' | 'offset'>;

/**
 * The people behind the leads, kept until deleted, in three layouts: a list grouped by
 * status, a table with every field (and bulk status, tag and delete), and a board with a
 * column per status where a card can be dragged to change it. A person opens in the drawer.
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
  const [layout, setLayout] = useLayoutPreference<ContactLayout>('leads-contacts', LAYOUTS, 'list');

  const board = layout === 'board';
  const size = board ? BOARD_SIZE : PAGE_SIZE;
  const listFilters: ContactListFilters = { search: search.trim(), status, tag, source, sort };
  const list = useContacts(websiteId, { ...listFilters, limit: size, offset: board ? 0 : page * size });
  const update = useUpdateContact(websiteId);
  const bulk = useBulkUpdateContacts(websiteId);

  const filtersKey = JSON.stringify(listFilters);
  useEffect(() => { onFiltersChange?.(JSON.parse(filtersKey)); }, [filtersKey, onFiltersChange]);
  // A narrower set, or a different page size, changes what page 2 means.
  useEffect(() => { setPage(0); }, [filtersKey, layout]);
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

  const filters: FilterField[] = [
    {
      id: 'status', label: 'Status', value: status, onChange: (v) => setStatus(v as ContactStatus | ''),
      options: CONTACT_STATUSES.map((s) => ({ value: s, label: STATUS_META[s].label, icon: <StatusDot status={s} /> })),
    },
    { id: 'tag', label: 'Tag', value: tag, onChange: setTag, options: tagOptions.map((t) => ({ value: t, label: t })) },
    {
      id: 'source', label: 'Source', value: source, onChange: (v) => setSource(v as ContactSource | ''),
      options: (Object.keys(SOURCE_LABEL) as ContactSource[]).map((s) => ({ value: s, label: SOURCE_LABEL[s] })),
    },
  ];

  const setStatusOf = (c: Contact, next: ContactStatus) => update.mutate(
    { id: c.id, patch: { status: next } },
    { onError: () => toast.error('Could not change the status. Please try again.') },
  );
  const groups = (order: ContactStatus[]): CollectionGroup[] => order.map((s) => ({
    id: s, label: STATUS_META[s].label, icon: <StatusDot status={s} />, count: statuses?.[s],
  }));

  const columns: CollectionColumn<Contact>[] = [
    {
      id: 'contact', header: 'Contact', width: '26%',
      cell: (c) => (
        <span className="flex min-w-0 items-center gap-2.5">
          <Avatar contact={c} />
          <span className="min-w-0">
            <button type="button" onClick={(e) => { e.stopPropagation(); onOpenContact(c.id); }} className="block max-w-full truncate text-left font-medium text-foreground focus-visible:underline focus-visible:outline-none" title={c.email}>
              {c.name || c.email}
            </button>
            {c.name && <span className="block truncate text-xs text-muted-foreground">{c.email}</span>}
          </span>
        </span>
      ),
    },
    {
      id: 'status', header: 'Status', width: '140px',
      cell: (c) => <StatusSelect value={c.status} ariaLabel={`Status of ${c.email}`} onChange={canEdit ? (next) => setStatusOf(c, next) : undefined} />,
    },
    { id: 'tags', header: 'Tags', width: '18%', cell: (c) => <span className="text-xs"><TagList tags={c.tags} /></span> },
    { id: 'source', header: 'Source', width: '130px', cell: (c) => <span className="text-foreground/80">{SOURCE_LABEL[c.source]}</span> },
    { id: 'first', header: 'First came from', width: '140px', cell: (c) => <span className="text-foreground/80">{cameFrom(c.first_channel)}</span> },
    { id: 'phone', header: 'Phone', width: '140px', cell: (c) => <span className="tabular-nums text-foreground/80">{c.phone || '—'}</span> },
    { id: 'forms', header: 'Forms', width: '70px', align: 'right', cell: (c) => <span className="tabular-nums text-foreground/80">{c.submission_count}</span> },
    {
      id: 'last', header: sort === 'created' ? 'Added' : 'Last activity', width: '110px', align: 'right', sorted: true,
      cell: (c) => <When iso={sort === 'created' ? c.created_at : c.last_activity_at} now={now} />,
    },
  ];

  const ids = [...selected.keys()];
  const applyBulk = (change: { status?: ContactStatus; add_tags?: string[] }, done: string) => bulk.mutate(
    { ids, ...change },
    { onSuccess: () => { toast.success(done); setSelected(new Map()); }, onError: () => toast.error('Could not update the contacts. Please try again.') },
  );

  const byId = new Map(contacts.map((c) => [c.id, c]));
  const selection = canEdit && layout === 'table' ? {
    selected: new Set(selected.keys()),
    labelOf: (id: string) => byId.get(id)?.email ?? id,
    onChange: (keys: string[], on: boolean) => setSelected((prev) => {
      const next = new Map(prev);
      keys.forEach((k) => { const c = byId.get(k); if (on && c) next.set(k, c); else next.delete(k); });
      return next;
    }),
  } : undefined;

  const body = list.isLoading ? <CollectionSkeleton /> : contacts.length === 0 ? (
    <CollectionEmpty
      icon={<Users />}
      title={narrowed ? 'No matches' : 'No contacts yet'}
      description={narrowed
        ? 'No contact matches these filters.'
        : 'Contacts appear here when someone fills in a form. You can also add people by hand or import a spreadsheet.'}
      action={!narrowed && canEdit ? (
        <div className="flex justify-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={onImport}><Upload className="h-3.5 w-3.5" />Import CSV</Button>
          <Button size="sm" className="gap-1.5" onClick={onAdd}><Plus className="h-3.5 w-3.5" />Add contact</Button>
        </div>
      ) : undefined}
    />
  ) : layout === 'table' ? (
    <CollectionTable label="Contacts" items={contacts} getKey={(c) => c.id} columns={columns} onOpen={(c) => onOpenContact(c.id)} selection={selection} minWidth={1080} />
  ) : board ? (
    <>
      <BoardView
        items={contacts}
        getKey={(c) => c.id}
        columns={groups([...CONTACT_STATUSES]).filter((g) => !status || g.id === status)}
        columnOf={(c) => c.status}
        onMove={canEdit ? (c, to) => setStatusOf(c, to as ContactStatus) : undefined}
        renderCard={(c) => <ContactCard contact={c} now={now} onOpen={() => onOpenContact(c.id)} />}
      />
      {total > contacts.length && (
        <p className="px-4 pb-4 text-xs text-muted-foreground">
          The board shows the {contacts.length} most recently active of {total.toLocaleString()} people. Use the filters or the table to reach the rest.
        </p>
      )}
    </>
  ) : (
    <GroupedRows
      items={contacts}
      getKey={(c) => c.id}
      groups={status ? undefined : groups(LIST_ORDER)}
      groupOf={(c) => c.status}
      renderRow={(c) => <ContactRow contact={c} now={now} sort={sort} onOpen={() => onOpenContact(c.id)} />}
    />
  );

  return (
    <>
      <FilterToolbar
        sort={{
          value: sort, onChange: (v) => setSort(v as ContactSort),
          options: [{ value: 'last_activity', label: 'Recent activity' }, { value: 'created', label: 'Newest contacts' }],
        }}
        filters={filters}
        search={{ value: search, onChange: setSearch, placeholder: 'Search email, name or phone…', label: 'Search contacts' }}
        count={list.data ? `${total.toLocaleString()} ${total === 1 ? 'person' : 'people'}` : undefined}
      >
        <LayoutSwitch layouts={LAYOUTS} value={layout} onChange={setLayout} />
      </FilterToolbar>

      {selected.size > 0 && layout === 'table' && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-primary/[0.04] px-4 py-1.5 text-[13px]">
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

      {body}
      {!board && <CollectionPager page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} />}

      <DeleteContactsDialog
        websiteId={websiteId}
        open={deleting}
        contacts={[...selected.values()]}
        onOpenChange={setDeleting}
        onDeleted={() => setSelected(new Map())}
      />
    </>
  );
}

const AVATAR_HUES = ['#5e6ad2', '#c2577a', '#2f8f83', '#b7791f', '#7a5bd1', '#3a7bd5'];

/** Initials on a colour picked from the email, so a person keeps theirs across layouts. */
function Avatar({ contact }: { contact: Contact }) {
  const source = contact.name || contact.email;
  const initials = (contact.name ? contact.name.split(/\s+/).map((w) => w[0]).join('') : contact.email[0] ?? '?').slice(0, 2).toUpperCase();
  let hash = 0;
  for (const ch of contact.email) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span
      aria-hidden
      title={source}
      className="flex size-[22px] shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
      style={{ background: AVATAR_HUES[hash % AVATAR_HUES.length] }}
    >
      {initials}
    </span>
  );
}

function When({ iso, now }: { iso: string; now?: number }) {
  return <time className="whitespace-nowrap text-xs text-muted-foreground" dateTime={iso} title={new Date(iso).toLocaleString()}>{relativeTime(iso, now)}</time>;
}

/** How a person arrived: "2 forms · from Search", "Added by hand", "Imported". */
function arrival(c: Contact): string {
  if (c.source !== 'form') return SOURCE_LABEL[c.source];
  const forms = `${c.submission_count} form${c.submission_count === 1 ? '' : 's'}`;
  return c.first_channel ? `${forms} · from ${cameFrom(c.first_channel)}` : forms;
}

/** What to know about a person at a glance: the first line of their notes, else how they arrived. */
function contactLine(c: Contact): string {
  return c.notes.trim().split('\n')[0] || arrival(c);
}

function ContactRow({ contact: c, now, sort, onOpen }: { contact: Contact; now?: number; sort: ContactSort; onOpen: () => void }) {
  return (
    <CollectionRow onOpen={onOpen}>
      <Avatar contact={c} />
      <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(); }} className="w-44 shrink-0 truncate text-left text-[13px] text-foreground focus-visible:underline focus-visible:outline-none" title={c.email}>
        {c.name || c.email}
      </button>
      <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">{contactLine(c)}</span>
      {c.tags.length > 0 && <span className="hidden shrink-0 text-xs md:block"><TagList tags={c.tags} max={2} /></span>}
      <span className="hidden w-48 shrink-0 truncate text-right text-xs text-muted-foreground xl:block" title={c.email}>{c.email}</span>
      <span className="w-16 shrink-0 text-right"><When iso={sort === 'created' ? c.created_at : c.last_activity_at} now={now} /></span>
    </CollectionRow>
  );
}

function ContactCard({ contact: c, now, onOpen }: { contact: Contact; now?: number; onOpen: () => void }) {
  return (
    <div onClick={onOpen} className={cn(CARD, 'cursor-pointer')}>
      <span className="flex items-center gap-2">
        <Avatar contact={c} />
        <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(); }} className="min-w-0 truncate text-left text-[13px] font-medium text-foreground focus-visible:underline focus-visible:outline-none">
          {c.name || c.email}
        </button>
        <span className="ml-auto shrink-0"><When iso={c.last_activity_at} now={now} /></span>
      </span>
      {c.name && <span className="truncate text-xs text-muted-foreground">{c.email}</span>}
      <span className="line-clamp-2 text-[12.5px] leading-snug text-foreground/75">{contactLine(c)}</span>
      {c.tags.length > 0 && <span className="text-xs"><TagList tags={c.tags} max={3} /></span>}
    </div>
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
