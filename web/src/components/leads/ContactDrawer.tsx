'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PlayCircle, RotateCw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { relativeTime } from '@/features/errors/format';
import { useRetryDelivery } from '@/features/integrations/mutations';
import { useUpdateContact } from '@/features/leads/mutations';
import { useContact } from '@/features/leads/queries';
import { formLabel, type Contact, type ContactStatus, type SiteSubmission, type SubmissionDelivery } from '@/features/leads/types';
import { describeDelivery } from '@/lib/integration-form';
import { pathOf } from '@/lib/submission-display';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { cameFrom } from './lead-format';
import { DeleteContactsDialog } from './ContactsTab';
import { StatusSelect, TagInput } from './parts';

type Draft = { name: string; phone: string; status: ContactStatus; tags: string[]; notes: string };
const toDraft = (c: Contact): Draft => ({ name: c.name, phone: c.phone, status: c.status, tags: c.tags, notes: c.notes });
const same = (a: Draft, b: Draft) => JSON.stringify(a) === JSON.stringify(b);

const TONE = {
  success: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  warning: 'bg-amber-500/10 text-amber-700 dark:text-amber-400',
  danger: 'bg-rose-500/10 text-rose-700 dark:text-rose-400',
  muted: 'bg-muted text-muted-foreground',
} as const;

/** "Ava Martin" → "AM"; an email → its first letter. */
function initials(c: Contact): string {
  const parts = c.name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
  return (parts[0]?.[0] ?? c.email[0] ?? '?').toUpperCase();
}

/**
 * One contact, wide: who they are and what can be changed (name, phone, status, tags, notes —
 * never the email, which ties their form submissions to them) beside everything known about
 * them: where they first came from, each form they filled in with every field they sent, and
 * where each submission was delivered, attempt by attempt.
 */
export function ContactDrawer({
  websiteId, contactId, now, canEdit, onClose,
}: { websiteId: string; contactId: string | null; now?: number; canEdit: boolean; onClose: () => void }) {
  const all = useT();
  const t = all.leads;
  const td = t.drawer;
  const time = all.errors.time;
  const detail = useContact(websiteId, contactId);
  const update = useUpdateContact(websiteId);
  const retry = useRetryDelivery(websiteId);
  /** Sends a failed delivery again; for those who may change things. */
  const onRetry = canEdit ? (deliveryId: string) => retry.mutate(deliveryId, {
    onSuccess: () => toast.success(t.destinations.retried),
    onError: () => toast.error(t.destinations.retryFailed),
  }) : undefined;
  const contact = detail.data?.contact ?? null;
  const submissions = useMemo(() => detail.data?.submissions ?? [], [detail.data]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState(false);

  // A fresh draft for each contact opened, and when a saved version comes back — not on every
  // background refetch, which would wipe what is being typed.
  const version = contact ? `${contact.id}:${contact.updated_at}` : '';
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setDraft(contact ? toDraft(contact) : null); }, [version]);

  /** Each integration their submissions went to, with how many arrived. */
  const integrations = useMemo(() => {
    const byConnection = new Map<string, { name: string; provider: string; ok: number; total: number }>();
    for (const s of submissions) {
      for (const d of s.deliveries) {
        const row = byConnection.get(d.connection_id) ?? { name: d.connection_name, provider: d.provider, ok: 0, total: 0 };
        row.total += 1;
        if (d.status === 'success') row.ok += 1;
        byConnection.set(d.connection_id, row);
      }
    }
    return [...byConnection.values()];
  }, [submissions]);

  const dirty = !!(contact && draft && !same(draft, toDraft(contact)));
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d));
  const save = () => {
    if (!contact || !draft) return;
    update.mutate(
      { id: contact.id, patch: { name: draft.name.trim(), phone: draft.phone.trim(), status: draft.status, tags: draft.tags, notes: draft.notes } },
      { onSuccess: () => toast.success(td.saved), onError: () => toast.error(td.saveFailed) },
    );
  };
  const ago = (iso: string) => relativeTime(iso, now, time);

  return (
    <Sheet open={!!contactId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-4xl">
        <SheetTitle className="sr-only">{td.title}</SheetTitle>
        {detail.isLoading || !draft || !contact ? (
          detail.isLoading || !contactId ? (
            <div className="space-y-3 p-6"><Skeleton className="h-6 w-56" /><Skeleton className="h-4 w-40" /><Skeleton className="h-40 w-full" /></div>
          ) : (
            <p className="p-6 text-sm text-muted-foreground">{td.gone}</p>
          )
        ) : (
          <div className="flex min-h-full flex-col">
            <header className="flex items-center gap-4 px-6 pb-5 pt-6 pr-14">
              <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted text-base font-semibold text-foreground/80">{initials(contact)}</span>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold tracking-tight" title={contact.name || contact.email}>{contact.name || contact.email}</h2>
                <p className="truncate text-[13px] text-muted-foreground">
                  {contact.name ? contact.email : null}
                  {contact.name && contact.phone ? ' · ' : null}
                  {contact.phone}
                </p>
              </div>
            </header>

            <div className="grid flex-1 lg:grid-cols-[minmax(0,1fr)_300px]">
              {/* Everything known about them */}
              {/* A grey ground with white blocks on it and no outlines, as the dashboard pages are laid out. */}
              <div className="min-w-0 space-y-4 bg-[hsl(var(--app-page))] px-6 py-5">
                <section aria-labelledby="contact-overview">
                  <h3 id="contact-overview" className="sr-only">{td.overview}</h3>
                  <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Stat label={td.submissions} value={contact.submission_count.toLocaleString()} />
                    <Stat label={td.firstSeenLabel} value={ago(contact.first_seen_at)} />
                    <Stat label={td.lastActivity} value={ago(contact.last_activity_at)} />
                    <Stat label={td.cameFrom} value={contact.first_channel ? cameFrom(t, contact.first_channel) : t.sources[contact.source]} />
                  </dl>
                </section>

                <section aria-labelledby="contact-origin">
                  <h3 id="contact-origin" className="mb-2 text-[14px] font-semibold text-foreground">{td.origin}</h3>
                  <dl className="divide-y divide-border/60 rounded-md bg-card text-[13.5px]">
                    <Row label={td.landedOnLabel} value={contact.first_page_url ? <span className="font-mono text-[12px]">{pathOf(contact.first_page_url) || '/'}</span> : '—'} title={contact.first_page_url ?? undefined} />
                    <Row label={td.referrer} value={contact.first_referrer || td.direct} title={contact.first_referrer ?? undefined} />
                    <Row label={td.firstSeenLabel} value={`${t.sources[contact.source]} · ${new Date(contact.first_seen_at).toLocaleString()}`} />
                  </dl>
                </section>

                <section aria-labelledby="contact-activity">
                  <h3 id="contact-activity" className="mb-2 text-[14px] font-semibold text-foreground">
                    {td.activity} <span className="font-normal text-muted-foreground">· {td.formSubmissions} {submissions.length}</span>
                  </h3>
                  {submissions.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{contact.source === 'form' ? td.expired : td.noForms}</p>
                  ) : (
                    <ol className="space-y-3">
                      {submissions.map((s) => <SubmissionCard key={s.id} s={s} websiteId={websiteId} ago={ago} onRetry={onRetry} />)}
                    </ol>
                  )}
                </section>
              </div>

              {/* What can be changed, and where their data goes */}
              <aside className="space-y-6 bg-card px-6 py-5">
                <section aria-labelledby="contact-details" className="space-y-4">
                  <h3 id="contact-details" className="text-sm font-semibold">{td.details}</h3>
                  <Field label={t.fields.name} id="contact-name">
                    <Input id="contact-name" value={draft.name} onChange={(e) => set('name', e.target.value)} disabled={!canEdit} maxLength={200} />
                  </Field>
                  <Field label={t.fields.phone} id="contact-phone">
                    <Input id="contact-phone" value={draft.phone} onChange={(e) => set('phone', e.target.value)} disabled={!canEdit} maxLength={50} />
                  </Field>
                  <Field label={t.fields.status} id="contact-status">
                    <StatusSelect value={draft.status} onChange={canEdit ? (st) => set('status', st) : undefined} className="h-9 w-full border-input bg-background" />
                  </Field>
                  <Field label={t.fields.tags} id="contact-tags">
                    <TagInput id="contact-tags" value={draft.tags} onChange={(tags) => set('tags', tags)} disabled={!canEdit} />
                  </Field>
                  <Field label={t.fields.notes} id="contact-notes">
                    <Textarea id="contact-notes" value={draft.notes} onChange={(e) => set('notes', e.target.value)} disabled={!canEdit} rows={4} maxLength={5000} placeholder={td.notesPlaceholder} />
                  </Field>
                  {canEdit && (
                    <div className="flex items-center justify-between gap-2">
                      <Button variant="ghost" size="sm" className="gap-1.5 px-2 text-muted-foreground hover:text-destructive" onClick={() => setDeleting(true)}>
                        <Trash2 className="h-3.5 w-3.5" />{td.deleteContact}
                      </Button>
                      <div className="flex gap-2">
                        {dirty && <Button variant="ghost" size="sm" onClick={() => setDraft(toDraft(contact))}>{td.discard}</Button>}
                        <Button size="sm" onClick={save} disabled={!dirty || update.isPending}>{all.actions.save}</Button>
                      </div>
                    </div>
                  )}
                </section>

                <section aria-labelledby="contact-integrations">
                  <h3 id="contact-integrations" className="mb-2 text-sm font-semibold">{td.integrations}</h3>
                  {integrations.length === 0 ? (
                    <p className="text-xs text-muted-foreground">{td.noIntegrations}</p>
                  ) : (
                    <ul className="divide-y divide-border/60">
                      {integrations.map((i) => (
                        <li key={i.name} className="flex items-center justify-between gap-3 py-2 text-[13px] first:pt-0 last:pb-0">
                          <span className="min-w-0">
                            <span className="block truncate font-medium">{i.name}</span>
                            <span className="block text-[11.5px] capitalize text-muted-foreground">{i.provider}</span>
                          </span>
                          <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[11.5px] font-medium', TONE[i.ok === i.total ? 'success' : i.ok === 0 ? 'danger' : 'warning'])}>
                            {td.deliveredOf(i.ok, i.total)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </aside>
            </div>
          </div>
        )}
        {contact && (
          <DeleteContactsDialog websiteId={websiteId} open={deleting} contacts={[contact]} onOpenChange={setDeleting} onDeleted={onClose} />
        )}
      </SheetContent>
    </Sheet>
  );
}

/** One form submission: which form, when, from where, every field sent, and each delivery. */
function SubmissionCard({ s, websiteId, ago, onRetry }: { s: SiteSubmission; websiteId: string; ago: (iso: string) => string; onRetry?: (deliveryId: string) => void }) {
  const t = useT().leads;
  const td = t.drawer;
  const data: [string, React.ReactNode][] = [
    ...(s.name ? [[t.fields.name, s.name] as [string, React.ReactNode]] : []),
    [t.fields.email, s.email],
    ...(s.phone ? [[t.fields.phone, s.phone] as [string, React.ReactNode]] : []),
    ...Object.entries(s.fields).map(([k, v]) => [k, String(v)] as [string, React.ReactNode]),
    ...(s.prize ? [[td.won, s.prize.label] as [string, React.ReactNode]] : []),
    ...(s.prize?.coupon_code ? [[td.coupon, <span key="c" className="font-mono">{s.prize.coupon_code}</span>] as [string, React.ReactNode]] : []),
    ...(s.variant ? [[td.variant, s.variant] as [string, React.ReactNode]] : []),
    [td.consent, s.consent ? td.yes : td.no],
  ];
  return (
    <li className="rounded-md bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[13.5px] font-semibold">{formLabel(s, t.form).text}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {ago(s.created_at)} · {cameFrom(t, s.channel, s.utm_campaign)}{s.utm_source ? ` · ${s.utm_source}` : ''} · <span className="font-mono">{pathOf(s.page_url) || '/'}</span>
          </p>
        </div>
        {s.has_replay && s.session_id && (
          <Button asChild variant="outline" size="sm" className="h-7 shrink-0 gap-1.5 px-2.5 text-xs">
            <Link href={`/websites/${websiteId}/replays/${s.session_id}`}><PlayCircle className="h-3.5 w-3.5" />{td.watch}</Link>
          </Button>
        )}
      </div>

      <p className="mb-1.5 mt-4 text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">{td.dataSubmitted}</p>
      <dl className="grid gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-2">
        {data.map(([k, v]) => (
          <div key={k} className="flex min-w-0 gap-2">
            <dt className="shrink-0 text-foreground/60">{k}</dt>
            <dd className="min-w-0 truncate text-foreground">{v}</dd>
          </div>
        ))}
      </dl>

      <p className="mb-1.5 mt-4 text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">{td.sentTo}</p>
      {s.deliveries.length === 0 ? (
        <p className="text-xs text-muted-foreground">{td.notSentAnywhere}</p>
      ) : (
        <ul className="divide-y divide-border/60">{s.deliveries.map((d) => <DeliveryRow key={d.id} d={d} ago={ago} onRetry={onRetry} />)}</ul>
      )}
    </li>
  );
}

/** Where one submission went: the integration, how it went, how many tries, and why it failed. */
function DeliveryRow({ d, ago, onRetry }: { d: SubmissionDelivery; ago: (iso: string) => string; onRetry?: (deliveryId: string) => void }) {
  const tl = useT().leads;
  const td = tl.drawer;
  const { label, tone } = describeDelivery(d);
  return (
    <li className="py-2 text-[13px] first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate">
          <span className="font-medium">{d.connection_name}</span>
          <span className="text-muted-foreground"> · <span className="capitalize">{d.provider}</span> · {td.attempts(d.attempt_count)}{d.completed_at ? ` · ${ago(d.completed_at)}` : ''}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {d.status === 'failed' && onRetry && (
            <Button size="sm" variant="outline" className="h-7 gap-1.5 px-2.5 text-xs" onClick={() => onRetry(d.id)}>
              <RotateCw className="h-3 w-3" />{tl.destinations.retry}
            </Button>
          )}
          <span className={cn('rounded-full px-2 py-0.5 text-[11.5px] font-medium', TONE[tone])}>{label}</span>
        </span>
      </div>
      {d.error && <p className="mt-1 text-xs text-rose-700 dark:text-rose-400">{d.error}</p>}
    </li>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md bg-card px-4 py-3">
      <dt className="text-[12px] font-medium text-foreground/60">{label}</dt>
      <dd className="mt-1 truncate text-[16px] font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function Row({ label, value, title }: { label: string; value: React.ReactNode; title?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-3.5 py-2.5">
      <dt className="shrink-0 font-medium text-foreground/60">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium text-foreground" title={title}>{value}</dd>
    </div>
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
