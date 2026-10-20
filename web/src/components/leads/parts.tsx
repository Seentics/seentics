'use client';

/** Small pieces the Leads page's tabs, drawer and dialogs share. */
import { useState } from 'react';
import { X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CONTACT_STATUSES, type ContactStatus, type SubmissionDelivery } from '@/features/leads/types';
import { describeDelivery } from '@/lib/integration-form';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import { STATUS_META } from './lead-format';

const TONE_DOT = { success: 'bg-emerald-500', warning: 'bg-amber-500', danger: 'bg-rose-500', muted: 'bg-muted-foreground/50' } as const;

/**
 * Where a submission was sent, as quiet "● Name" pairs; the dot carries the outcome. A failed one is
 * named in red, with Retry beside it when `onRetry` is given (someone who may change things).
 */
export function SentTo({ deliveries, onRetry, retrying }: {
  deliveries: readonly SubmissionDelivery[];
  onRetry?: (delivery: SubmissionDelivery) => void;
  retrying?: boolean;
}) {
  const all = useT();
  const t = all.leads.parts;
  if (deliveries.length === 0) return <span className="text-muted-foreground">{t.notSent}</span>;
  return (
    <span className="flex flex-wrap gap-x-3 gap-y-1">
      {deliveries.map((d) => {
        const { label, tone } = describeDelivery(d);
        const failed = d.status === 'failed';
        return (
          <span key={d.id} className="inline-flex items-center gap-1.5 whitespace-nowrap" title={`${d.connection_name}: ${label}${d.error ? ` — ${d.error}` : ''}`}>
            <span className={cn('h-1.5 w-1.5 rounded-full', TONE_DOT[tone])} aria-hidden />
            <span className={failed ? 'font-medium text-rose-700 dark:text-rose-400' : 'text-foreground/80'}>{d.connection_name}</span>
            <span className="sr-only">{label}</span>
            {failed && onRetry && (
              <button
                type="button"
                disabled={retrying}
                // A row opens its contact on click; Retry is for itself.
                onClick={(e) => { e.stopPropagation(); onRetry(d); }}
                className="rounded px-1 text-[11.5px] font-medium text-foreground underline underline-offset-2 hover:text-primary disabled:opacity-50"
              >
                {all.leads.destinations.retry}
              </button>
            )}
          </span>
        );
      })}
    </span>
  );
}

export function StatusDot({ status }: { status: ContactStatus }) {
  return <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', STATUS_META[status].dot)} aria-hidden />;
}

/** A contact's status as a compact select; read-only text where changes are not allowed. */
export function StatusSelect({
  value, onChange, disabled, className, ariaLabel,
}: { value: ContactStatus; onChange?: (next: ContactStatus) => void; disabled?: boolean; className?: string; ariaLabel?: string }) {
  const t = useT().leads;
  if (!onChange) {
    return (
      <span className={cn('inline-flex items-center gap-1.5 text-[13px]', className)}>
        <StatusDot status={value} />{t.statuses[value]}
      </span>
    );
  }
  return (
    <Select value={value} onValueChange={(v) => onChange(v as ContactStatus)} disabled={disabled}>
      <SelectTrigger
        aria-label={ariaLabel ?? t.fields.status}
        className={cn('h-7 w-[124px] gap-1.5 border-transparent bg-transparent px-2 text-[13px] shadow-none hover:bg-muted/60', className)}
        onClick={(e) => e.stopPropagation()}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent onClick={(e) => e.stopPropagation()}>
        {CONTACT_STATUSES.map((s) => (
          <SelectItem key={s} value={s} className="text-[13px]">
            <span className="inline-flex items-center gap-2"><StatusDot status={s} />{t.statuses[s]}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function TagList({ tags, max = 3 }: { tags: readonly string[]; max?: number }) {
  if (tags.length === 0) return <span className="text-muted-foreground">—</span>;
  const shown = tags.slice(0, max);
  return (
    <span className="flex flex-wrap gap-1">
      {shown.map((t) => <span key={t} className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-foreground/80">{t}</span>)}
      {tags.length > max && <span className="px-1 text-[11px] text-muted-foreground">+{tags.length - max}</span>}
    </span>
  );
}

/** Tags as removable chips with a field to add more (Enter or comma adds; Backspace on empty removes the last). */
export function TagInput({ value, onChange, disabled, id }: { value: string[]; onChange: (tags: string[]) => void; disabled?: boolean; id?: string }) {
  const t = useT().leads.parts;
  const [draft, setDraft] = useState('');
  const add = (raw: string) => {
    const tags = raw.split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
    if (tags.length) onChange([...new Set([...value, ...tags])].slice(0, 20));
    setDraft('');
  };
  return (
    <div className={cn('flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5', disabled && 'opacity-60')}>
      {value.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-xs">
          {tag}
          {!disabled && (
            <button type="button" aria-label={t.removeTag(tag)} className="text-muted-foreground hover:text-foreground" onClick={() => onChange(value.filter((x) => x !== tag))}>
              <X className="h-3 w-3" />
            </button>
          )}
        </span>
      ))}
      <Input
        id={id}
        value={draft}
        disabled={disabled}
        onChange={(e) => (e.target.value.endsWith(',') ? add(e.target.value) : setDraft(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); add(draft); }
          if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={() => draft && add(draft)}
        placeholder={value.length ? '' : t.addTag}
        className="h-6 min-w-[6rem] flex-1 border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
      />
    </div>
  );
}
