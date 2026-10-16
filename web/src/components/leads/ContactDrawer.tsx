'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PlayCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { relativeTime } from '@/features/errors/format';
import { useUpdateContact } from '@/features/leads/mutations';
import { useContact } from '@/features/leads/queries';
import type { Contact, ContactStatus } from '@/features/leads/types';
import { pathOf } from '@/lib/submission-display';
import { cameFrom, SOURCE_LABEL } from './lead-format';
import { DeleteContactsDialog } from './ContactsTab';
import { SentTo, StatusSelect, TagInput } from './parts';

type Draft = { name: string; phone: string; status: ContactStatus; tags: string[]; notes: string };
const toDraft = (c: Contact): Draft => ({ name: c.name, phone: c.phone, status: c.status, tags: c.tags, notes: c.notes });
const same = (a: Draft, b: Draft) => JSON.stringify(a) === JSON.stringify(b);

/**
 * One contact: what can be changed (name, phone, status, tags, notes — never the email, which
 * is what ties their form submissions to them), where they first came from, and every form they
 * filled in, each with the recording of that visit.
 */
export function ContactDrawer({
  websiteId, contactId, now, canEdit, onClose,
}: { websiteId: string; contactId: string | null; now?: number; canEdit: boolean; onClose: () => void }) {
  const detail = useContact(websiteId, contactId);
  const update = useUpdateContact(websiteId);
  const contact = detail.data?.contact ?? null;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState(false);

  // A fresh draft for each contact opened, and when a saved version comes back — not on every
  // background refetch, which would wipe what is being typed.
  const version = contact ? `${contact.id}:${contact.updated_at}` : '';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setDraft(contact ? toDraft(contact) : null); }, [version]);

  const dirty = !!(contact && draft && !same(draft, toDraft(contact)));
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d));
  const save = () => {
    if (!contact || !draft) return;
    update.mutate(
      { id: contact.id, patch: { name: draft.name.trim(), phone: draft.phone.trim(), status: draft.status, tags: draft.tags, notes: draft.notes } },
      { onSuccess: () => toast.success('Contact saved'), onError: () => toast.error('Could not save the contact. Please try again.') },
    );
  };

  return (
    <Sheet open={!!contactId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetTitle className="sr-only">Contact</SheetTitle>
        {detail.isLoading || !draft || !contact ? (
          detail.isLoading || !contactId ? (
            <div className="space-y-3 p-6"><Skeleton className="h-6 w-56" /><Skeleton className="h-4 w-40" /><Skeleton className="h-40 w-full" /></div>
          ) : (
            <p className="p-6 text-sm text-muted-foreground">This contact no longer exists.</p>
          )
        ) : (
          <div className="flex min-h-full flex-col">
            <header className="border-b border-border px-6 pb-5 pt-6 pr-12">
              <h2 className="truncate text-lg font-semibold tracking-tight" title={contact.email}>{contact.email}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {SOURCE_LABEL[contact.source]} · first seen {relativeTime(contact.first_seen_at, now)}
                {contact.first_channel ? ` from ${cameFrom(contact.first_channel)}` : ''}
              </p>
              {contact.first_page_url && (
                <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground" title={contact.first_page_url}>Landed on {pathOf(contact.first_page_url) || '/'}</p>
              )}
            </header>

            <div className="space-y-4 px-6 py-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name" id="contact-name">
                  <Input id="contact-name" value={draft.name} onChange={(e) => set('name', e.target.value)} disabled={!canEdit} maxLength={200} />
                </Field>
                <Field label="Phone" id="contact-phone">
                  <Input id="contact-phone" value={draft.phone} onChange={(e) => set('phone', e.target.value)} disabled={!canEdit} maxLength={50} />
                </Field>
              </div>
              <Field label="Status" id="contact-status">
                <StatusSelect value={draft.status} onChange={canEdit ? (s) => set('status', s) : undefined} className="h-9 w-full border-input bg-background" />
              </Field>
              <Field label="Tags" id="contact-tags">
                <TagInput id="contact-tags" value={draft.tags} onChange={(t) => set('tags', t)} disabled={!canEdit} />
              </Field>
              <Field label="Notes" id="contact-notes">
                <Textarea id="contact-notes" value={draft.notes} onChange={(e) => set('notes', e.target.value)} disabled={!canEdit} rows={4} maxLength={5000} placeholder="Calls, follow-ups, anything worth remembering…" />
              </Field>
              {canEdit && (
                <div className="flex items-center justify-between gap-2">
                  <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-destructive" onClick={() => setDeleting(true)}>
                    <Trash2 className="h-3.5 w-3.5" />Delete contact
                  </Button>
                  <div className="flex gap-2">
                    {dirty && <Button variant="ghost" size="sm" onClick={() => setDraft(toDraft(contact))}>Discard</Button>}
                    <Button size="sm" onClick={save} disabled={!dirty || update.isPending}>Save</Button>
                  </div>
                </div>
              )}
            </div>

            <section className="border-t border-border px-6 py-5" aria-labelledby="contact-timeline">
              <h3 id="contact-timeline" className="text-sm font-semibold">
                Form submissions <span className="font-normal text-muted-foreground">· {detail.data!.submissions.length}</span>
              </h3>
              {detail.data!.submissions.length === 0 ? (
                <p className="mt-2 text-xs text-muted-foreground">
                  {contact.source === 'form' ? 'Their submissions have passed the 90-day limit for keeping them.' : 'This contact has not filled in a form.'}
                </p>
              ) : (
                <ol className="mt-3 space-y-3">
                  {detail.data!.submissions.map((s) => (
                    <li key={s.id} className="rounded-lg border border-border p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-medium">{s.form_name ?? 'Deleted form'}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {relativeTime(s.created_at, now)} · {cameFrom(s.channel, s.utm_campaign)} · <span className="font-mono">{pathOf(s.page_url) || '/'}</span>
                          </p>
                        </div>
                        {s.has_replay && s.session_id && (
                          <Button asChild variant="ghost" size="sm" className="h-7 shrink-0 gap-1.5 px-2 text-xs">
                            <Link href={`/websites/${websiteId}/replays/${s.session_id}`}><PlayCircle className="h-3.5 w-3.5" />Watch</Link>
                          </Button>
                        )}
                      </div>
                      {(s.prize || Object.keys(s.fields).length > 0) && (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {s.prize && <>Won <span className="text-foreground">{s.prize.label}</span>{Object.keys(s.fields).length ? ' · ' : ''}</>}
                          {Object.entries(s.fields).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                        </p>
                      )}
                      <div className="mt-2 text-xs"><SentTo deliveries={s.deliveries} /></div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        )}
        {contact && (
          <DeleteContactsDialog websiteId={websiteId} open={deleting} contacts={[contact]} onOpenChange={setDeleting} onDeleted={onClose} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
