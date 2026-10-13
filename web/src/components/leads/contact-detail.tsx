import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { relativeTime } from '@/features/errors/format';
import { CONTACT_STATUSES, type ContactDetail as ContactDetailData, type ContactStatus } from '@/features/leads/types';

export interface ContactDetailProps extends ContactDetailData {
  isUpdating?: boolean;
  onSetStatus: (status: ContactStatus) => void;
  onDelete: () => void;
  className?: string;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium">{children}</dd>
    </div>
  );
}

/**
 * One contact and every submission behind it.
 *
 * Submissions carry the attribution — which popup, which A/B variant, which page — that
 * is the reason leads are captured in the same product as the analytics.
 */
export function ContactDetail({ contact, submissions, isUpdating, onSetStatus, onDelete, className }: ContactDetailProps) {
  return (
    <div className={cn('space-y-4', className)}>
      <div className="surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold">{contact.email}</h2>
            {contact.name && <p className="text-sm text-muted-foreground">{contact.name}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Select value={contact.status} onValueChange={(v) => onSetStatus(v as ContactStatus)} disabled={isUpdating}>
              <SelectTrigger className="h-8 w-32 text-xs capitalize"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CONTACT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="text-xs capitalize">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="ghost" className="h-8 gap-1 text-destructive hover:text-destructive" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
          </div>
        </div>
        <dl className="mt-3 divide-y divide-border">
          <Row label="Phone">{contact.phone || '—'}</Row>
          <Row label="Marketing consent">{contact.consent ? 'Given' : 'Not given'}</Row>
          <Row label="Submissions">{contact.submission_count}</Row>
          <Row label="First submitted">{relativeTime(contact.first_submitted_at)}</Row>
          <Row label="Last submitted">{relativeTime(contact.last_submitted_at)}</Row>
        </dl>
      </div>

      <div className="surface overflow-hidden">
        <div className="border-b border-border bg-muted/20 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Submissions
        </div>
        {submissions.map((s) => (
          <div key={s.id} className="border-b border-border px-4 py-3 text-sm last:border-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">
                {s.automation_name ?? 'Unknown popup'}
                {s.variant && <span className="ml-2 text-xs font-normal text-muted-foreground">variant {s.variant}</span>}
              </span>
              <span className="text-xs text-muted-foreground">{relativeTime(s.created_at)}</span>
            </div>
            {s.page_url && <p className="mt-1 truncate text-xs text-muted-foreground">{s.page_url}</p>}
            {Object.keys(s.fields).length > 0 && (
              <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
                {Object.entries(s.fields).map(([k, v]) => (
                  <div key={k} className="contents">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="break-words">{String(v)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
