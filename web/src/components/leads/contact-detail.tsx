'use client';

import { useState } from 'react';
import { Calendar, Check, Clock, Copy, Mail, Megaphone, Phone, ShieldCheck, ShieldOff, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatCards } from '@/components/seentics-ui/StatCards';
import { cn } from '@/lib/utils';
import { relativeTime } from '@/features/errors/format';
import { CONTACT_STATUSES, type ContactDetail as ContactDetailData, type ContactStatus } from '@/features/leads/types';
import { avatarTone, hostOf, initials, pathOf } from '@/lib/lead-display';
import { ContactTimeline } from './contact-timeline';
import { STATUS_TONE } from './contact-list';

export interface ContactDetailProps extends ContactDetailData {
  isUpdating?: boolean;
  /** For the demo, whose sample data is dated against a fixed clock. */
  now?: number;
  onSetStatus: (status: ContactStatus) => void;
  onDelete: () => void;
  className?: string;
}

const STATUS_LABEL: Record<ContactStatus, string> = { new: 'New', contacted: 'Contacted', archived: 'Archived' };

function Detail({ icon: Icon, label, children }: { icon: React.ElementType; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-2.5">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 break-words text-sm font-medium">{children}</dd>
      </div>
    </div>
  );
}

/**
 * One contact in full: who they are, what to do about them, and everything they sent.
 *
 * A header with the actions that matter (email them, move them along, erase them), the
 * figures that summarise the relationship, then the submissions as a timeline beside a
 * details panel. Takes data and callbacks only, so the demo and the live page share it.
 */
export function ContactDetail({ contact, submissions, isUpdating, now, onSetStatus, onDelete, className }: ContactDetailProps) {
  const [copied, setCopied] = useState(false);
  const copyEmail = async () => {
    try {
      await navigator.clipboard.writeText(contact.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable */ }
  };

  // The earliest submission is the first touch: where this person came from.
  const first = submissions[submissions.length - 1];

  return (
    <div className={cn('space-y-4', className)}>
      <div className="surface p-5">
        <div className="flex flex-wrap items-start gap-4">
          <div className={cn('flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-semibold', avatarTone(contact.email))} aria-hidden>
            {initials(contact.name, contact.email)}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-xl font-semibold">{contact.name || contact.email}</h2>
              <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize', STATUS_TONE[contact.status])}>{contact.status}</span>
            </div>
            <p className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
              <span className="truncate">{contact.email}</span>
              <button
                type="button" onClick={() => void copyEmail()}
                aria-label="Copy email address"
                className="inline-flex shrink-0 items-center gap-1 rounded px-1 text-xs hover:text-foreground"
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button asChild size="sm" className="h-9 gap-1.5">
              <a href={`mailto:${contact.email}`}><Mail className="h-4 w-4" /> Email</a>
            </Button>
            <Button size="sm" variant="ghost" className="h-9 gap-1.5 text-destructive hover:text-destructive" onClick={onDelete}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border pt-4">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</span>
          <div role="group" aria-label="Contact status" className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5">
            {CONTACT_STATUSES.map((s) => (
              <button
                key={s} type="button"
                disabled={isUpdating}
                aria-pressed={contact.status === s}
                onClick={() => contact.status !== s && onSetStatus(s)}
                className={cn(
                  'rounded-md px-3 py-1 text-xs font-medium transition-colors disabled:opacity-60',
                  contact.status === s ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {STATUS_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <StatCards
        className="!mb-0"
        cards={[
          { label: 'Submissions', value: contact.submission_count, icon: Mail, tone: 'accent' },
          { label: 'First submitted', value: relativeTime(contact.first_submitted_at, now), icon: Calendar },
          { label: 'Last submitted', value: relativeTime(contact.last_submitted_at, now), icon: Clock },
          { label: 'Marketing consent', value: contact.consent ? 'Given' : 'Not given', icon: contact.consent ? ShieldCheck : ShieldOff, tone: 'success', toneWhen: contact.consent },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="surface overflow-hidden">
          <div className="border-b border-border bg-muted/20 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Activity
          </div>
          <ContactTimeline submissions={submissions} now={now} className="py-4" />
        </div>

        <div className="surface h-fit p-4">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Details</h3>
          <dl className="mt-1 divide-y divide-border">
            <Detail icon={Mail} label="Email">{contact.email}</Detail>
            <Detail icon={Phone} label="Phone">{contact.phone || <span className="font-normal text-muted-foreground">Not provided</span>}</Detail>
            <Detail icon={Megaphone} label="First touch">
              {first ? (
                <>
                  {first.automation_name ?? 'Unknown popup'}
                  <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                    {[first.page_url ? pathOf(first.page_url) : '', hostOf(first.referrer) || 'Direct'].filter(Boolean).join(' · ')}
                  </span>
                </>
              ) : '—'}
            </Detail>
            <Detail icon={contact.consent ? ShieldCheck : ShieldOff} label="Consent">
              {contact.consent
                ? 'Agreed to receive marketing emails'
                : <span className="font-normal text-muted-foreground">No marketing consent recorded. Only email them about what they asked for.</span>}
            </Detail>
          </dl>
        </div>
      </div>
    </div>
  );
}
