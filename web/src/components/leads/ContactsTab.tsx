'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Plus, Tag, Trash2, Upload, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  BoardView, CARD, COLLECTION_SURFACE, CollectionEmpty, CollectionPager, CollectionRow, CollectionSkeleton, CollectionTable,
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
import { useLocale, useT } from '@/lib/i18n';
import type { LeadsMessages } from '@/lib/i18n/messages/leads-en';
import { cameFrom } from './lead-format';
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
  websiteId, now, canEdit, onOpenContact, onAdd, onImport, onFiltersChange, tabs,
}: {
  websiteId: string;
  now?: number;
  canEdit: boolean;
  onOpenContact: (contactId: string) => void;
  onAdd: () => void;
  onImport: () => void;
  onFiltersChange?: (filters: ContactListFilters) => void;
  /** The page's tabs (People / Submissions), on the left of this tab's toolbar. */
  tabs?: ReactNode;
}) {
  const all = useT();
  const t = all.leads;
  const tc = t.contacts;
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ContactStatus | ''>('');
  const [tag, setTag] = useState('');
  const [source, setSource] = useState<ContactSource | ''>('');
  const [sort, setSort] = useState<ContactSort>('last_activity');
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Map<string, Contact>>(new Map());
  const [deleting, setDeleting] = useState(false);
  // Table first: the people side by side, with checkboxes for status, tags or delete on several at once.
  const [layout, setLayout] = useLayoutPreference<ContactLayout>('leads-contacts', LAYOUTS, 'table');

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
    () => [...new Set([...(siteTags ?? []).map((x) => x.tag), ...contacts.flatMap((c) => c.tags), ...(tag ? [tag] : [])])].sort(),
    [siteTags, contacts, tag],
  );

  const filters: FilterField[] = [
    {
      id: 'status', label: t.fields.status, value: status, onChange: (v) => setStatus(v as ContactStatus | ''),
      options: CONTACT_STATUSES.map((s) => ({ value: s, label: t.statuses[s], icon: <StatusDot status={s} /> })),
    },
    { id: 'tag', label: tc.tag, value: tag, onChange: setTag, options: tagOptions.map((x) => ({ value: x, label: x })) },
    {
      id: 'source', label: tc.source, value: source, onChange: (v) => setSource(v as ContactSource | ''),
      options: (Object.keys(t.sources) as ContactSource[]).map((s) => ({ value: s, label: t.sources[s] })),
    },
  ];

  const setStatusOf = (c: Contact, next: ContactStatus) => update.mutate(
    { id: c.id, patch: { status: next } },
    { onError: () => toast.error(tc.statusFailed) },
  );
  const groups = (order: ContactStatus[]): CollectionGroup[] => order.map((s) => ({
    id: s, label: t.statuses[s], icon: <StatusDot status={s} />, count: statuses?.[s],
  }));

  const columns: CollectionColumn<Contact>[] = [
    {
      id: 'contact', header: tc.contact,
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
      id: 'status', header: t.fields.status, width: '140px',
      cell: (c) => <StatusSelect value={c.status} ariaLabel={tc.statusOf(c.email)} onChange={canEdit ? (next) => setStatusOf(c, next) : undefined} />,
    },
    // Who they are, where they stand, how they are tagged and when they were last seen; source,
    // phone and forms are on the contact's own panel.
    { id: 'tags', header: t.fields.tags, width: '24%', cell: (c) => <span className="text-xs"><TagList tags={c.tags} /></span> },
    {
      id: 'last', header: sort === 'created' ? tc.added : tc.lastActivity, width: '110px', align: 'right', sorted: true,
      cell: (c) => <When iso={sort === 'created' ? c.created_at : c.last_activity_at} now={now} />,
    },
  ];

  const ids = [...selected.keys()];
  const applyBulk = (change: { status?: ContactStatus; add_tags?: string[] }, done: string) => bulk.mutate(
    { ids, ...change },
    { onSuccess: () => { toast.success(done); setSelected(new Map()); }, onError: () => toast.error(tc.bulkFailed) },
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

  /** The panel's top row: the page's tabs on the left, this list's controls on the right. */
  const toolbar = (
    <FilterToolbar
      leading={tabs}
      sort={{
        value: sort, onChange: (v) => setSort(v as ContactSort),
        options: [{ value: 'last_activity', label: tc.sortRecent }, { value: 'created', label: tc.sortNewest }],
      }}
      filters={filters}
      search={{ value: search, onChange: setSearch, placeholder: tc.searchPlaceholder, label: tc.searchLabel }}
      count={tabs ? undefined : list.data ? tc.count(total, total.toLocaleString()) : undefined}
    >
      <LayoutSwitch layouts={LAYOUTS} value={layout} onChange={setLayout} />
    </FilterToolbar>
  );
  // The bulk actions, under the toolbar inside the table's panel while rows are picked.
  const bulkBar = selected.size > 0 && layout === 'table' ? (
    <div className="flex flex-wrap items-center gap-2 border-b border-border/70 bg-muted/60 px-4 py-1.5 text-[13px]">
      <span className="font-medium text-foreground">{tc.selected(selected.size)}</span>
      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelected(new Map())}>{all.actions.clear}</Button>
      <span className="mx-1 h-4 w-px bg-border" aria-hidden />
      <Select onValueChange={(v) => applyBulk({ status: v as ContactStatus }, tc.statusSet(t.statuses[v as ContactStatus]))}>
        <SelectTrigger className={cn(GHOST_CONTROL, 'h-7 w-auto gap-2 px-2.5 text-xs')} aria-label={tc.setStatus}><SelectValue placeholder={tc.setStatus} /></SelectTrigger>
        <SelectContent>
          {CONTACT_STATUSES.map((s) => (
            <SelectItem key={s} value={s} className="text-xs"><span className="inline-flex items-center gap-2"><StatusDot status={s} />{t.statuses[s]}</span></SelectItem>
          ))}
        </SelectContent>
      </Select>
      <AddTagButton onAdd={(tag) => applyBulk({ add_tags: [tag] }, tc.tagged(selected.size, tag))} />
      <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs text-destructive hover:text-destructive" onClick={() => setDeleting(true)}>
        <Trash2 className="h-3.5 w-3.5" />{all.actions.delete}
      </Button>
    </div>
  ) : null;

  const body = list.isLoading ? <div className={COLLECTION_SURFACE}>{toolbar}<CollectionSkeleton /></div> : contacts.length === 0 ? (
    <div className={COLLECTION_SURFACE}>{toolbar}<CollectionEmpty
      icon={<Users />}
      title={narrowed ? tc.noMatches : tc.empty}
      description={narrowed ? tc.noMatchBody : tc.emptyBody}
      action={!narrowed && canEdit ? (
        <div className="flex justify-center gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={onImport}><Upload className="h-3.5 w-3.5" />{tc.importCsv}</Button>
          <Button size="sm" className="gap-1.5" onClick={onAdd}><Plus className="h-3.5 w-3.5" />{t.page.addContact}</Button>
        </div>
      ) : undefined}
    /></div>
  ) : layout === 'table' ? (
    <CollectionTable label={tc.tableLabel} items={contacts} getKey={(c) => c.id} columns={columns} onOpen={(c) => onOpenContact(c.id)} selection={selection} minWidth={720} rowClassName="h-14" toolbar={<>{toolbar}{bulkBar}</>} />
  ) : board ? (
    <>
      {/* The board's columns are panels of their own: the toolbar sits on its own white strip above them. */}
      <div className="mx-3 mt-3 overflow-clip rounded-lg bg-card md:mx-4 md:mt-4 [&>div]:rounded-lg [&>div]:border-b-0">{toolbar}</div>
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
          {tc.boardMore(contacts.length, total.toLocaleString())}
        </p>
      )}
    </>
  ) : (
    <GroupedRows
      toolbar={toolbar}
      items={contacts}
      getKey={(c) => c.id}
      groups={status ? undefined : groups(LIST_ORDER)}
      groupOf={(c) => c.status}
      renderRow={(c) => <ContactRow contact={c} now={now} sort={sort} onOpen={() => onOpenContact(c.id)} />}
    />
  );

  return (
    <>
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
  const time = useT().errors.time;
  const { locale } = useLocale();
  return (
    <time className="whitespace-nowrap text-xs text-muted-foreground" dateTime={iso} title={new Date(iso).toLocaleString(locale === 'bn' ? 'bn-BD-u-nu-latn' : undefined)}>
      {relativeTime(iso, now, time)}
    </time>
  );
}

/** How a person arrived: "2 forms · from Search", "Added by hand", "Imported". */
function arrival(c: Contact, t: LeadsMessages): string {
  if (c.source !== 'form') return t.sources[c.source];
  const forms = t.contacts.formsCount(c.submission_count);
  return c.first_channel ? `${forms} · ${t.contacts.from(cameFrom(t, c.first_channel))}` : forms;
}

/** What to know about a person at a glance: the first line of their notes, else how they arrived. */
function contactLine(c: Contact, t: LeadsMessages): string {
  return c.notes.trim().split('\n')[0] || arrival(c, t);
}

function ContactRow({ contact: c, now, sort, onOpen }: { contact: Contact; now?: number; sort: ContactSort; onOpen: () => void }) {
  const t = useT().leads;
  return (
    <CollectionRow onOpen={onOpen}>
      <Avatar contact={c} />
      <button type="button" onClick={(e) => { e.stopPropagation(); onOpen(); }} className="w-44 shrink-0 truncate text-left text-[13px] text-foreground focus-visible:underline focus-visible:outline-none" title={c.email}>
        {c.name || c.email}
      </button>
      <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">{contactLine(c, t)}</span>
      {c.tags.length > 0 && <span className="hidden shrink-0 text-xs md:block"><TagList tags={c.tags} max={2} /></span>}
      <span className="hidden w-48 shrink-0 truncate text-right text-xs text-muted-foreground xl:block" title={c.email}>{c.email}</span>
      <span className="w-16 shrink-0 text-right"><When iso={sort === 'created' ? c.created_at : c.last_activity_at} now={now} /></span>
    </CollectionRow>
  );
}

function ContactCard({ contact: c, now, onOpen }: { contact: Contact; now?: number; onOpen: () => void }) {
  const t = useT().leads;
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
      <span className="line-clamp-2 text-[12.5px] leading-snug text-foreground/75">{contactLine(c, t)}</span>
      {c.tags.length > 0 && <span className="text-xs"><TagList tags={c.tags} max={3} /></span>}
    </div>
  );
}

function AddTagButton({ onAdd }: { onAdd: (tag: string) => void }) {
  const all = useT();
  const tc = all.leads.contacts;
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState('');
  const submit = () => {
    const tag = value.trim().toLowerCase();
    if (!tag) return;
    onAdd(tag);
    setValue('');
    setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs"><Tag className="h-3.5 w-3.5" />{tc.addTag}</Button>
      </PopoverTrigger>
      <PopoverContent className="w-60 p-2" align="start">
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex gap-2">
          <Input autoFocus value={value} onChange={(e) => setValue(e.target.value)} placeholder={tc.tagName} className="h-8 text-xs" aria-label={tc.tagName} />
          <Button type="submit" size="sm" className="h-8">{all.actions.add}</Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

/** Deleting contacts, with the choice to take their form submissions too (what a GDPR erasure needs). */
export function DeleteContactsDialog({
  websiteId, open, contacts, onOpenChange, onDeleted,
}: { websiteId: string; open: boolean; contacts: Contact[]; onOpenChange: (open: boolean) => void; onDeleted?: () => void }) {
  const all = useT();
  const t = all.leads.remove;
  const [withSubmissions, setWithSubmissions] = useState(false);
  const remove = useDeleteContacts(websiteId);
  const n = contacts.length;
  const who = n === 1 ? contacts[0]!.email : t.many(n);
  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) setWithSubmissions(false); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.title(who)}</DialogTitle>
          <DialogDescription>
            {t.body}
          </DialogDescription>
        </DialogHeader>
        <Label className="flex items-start gap-2.5 text-sm font-normal">
          <Checkbox checked={withSubmissions} onCheckedChange={(v) => setWithSubmissions(!!v)} className="mt-0.5" />
          <span>{t.withSubmissions}<span className="block text-xs text-muted-foreground">{t.withSubmissionsHint}</span></span>
        </Label>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{all.actions.cancel}</Button>
          <Button
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => remove.mutate(
              { ids: contacts.map((c) => c.id), withSubmissions },
              {
                onSuccess: () => { toast.success(t.deleted(n)); onOpenChange(false); onDeleted?.(); },
                onError: () => toast.error(t.failed),
              },
            )}
          >
            {all.actions.delete}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
