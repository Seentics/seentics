import { RotateCcw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { relativeTime } from '@/features/errors/format';
import type { Submission } from '@/features/leads/types';
import { StatusBadge } from '@/components/integrations/StatusBadge';
import { canRetry, describeDelivery } from '@/lib/integration-form';
import { avatarTone, hostOf, humanizeKey, initials, pathOf } from '@/lib/submission-display';
import { cn } from '@/lib/utils';
import { useLocale, useT } from '@/lib/i18n';

export interface SubmissionRowProps {
  submission: Submission;
  /** For the demo, whose sample data is dated against a fixed clock. */
  now?: number;
  canDelete: boolean;
  deleting?: boolean;
  onDelete: (submission: Submission) => void;
  /** Puts a delivery that gave up back in the queue. Omitted where changes are not allowed. */
  onRetry?: (deliveryId: string) => void;
  retryingId?: string | null;
}

/** One submission: who, what they answered and won, where from, and where it was sent. */
export function SubmissionRow({ submission: s, now, canDelete, deleting, onDelete, onRetry, retryingId }: SubmissionRowProps) {
  const t = useT();
  const m = t.automations.submissions.row;
  const { locale } = useLocale();
  const source = hostOf(s.referrer);
  const answers = Object.entries(s.fields);
  return (
    <li className="grid gap-3 border-b border-border px-4 py-3 last:border-0 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center">
      <div className="flex min-w-0 items-center gap-3">
        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold', avatarTone(s.email))} aria-hidden>
          {initials(s.name, s.email)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium" title={s.email}>{s.email}</p>
          <p className="truncate text-xs text-muted-foreground">
            {[s.name, s.phone].filter(Boolean).join(' · ') || m.noName}
            {s.consent ? m.consented : ''}
          </p>
        </div>
      </div>

      <div className="min-w-0 space-y-1 text-xs">
        {s.prize && (
          <p className="truncate">
            <span className="text-muted-foreground">{s.prize.coupon_code ? m.won : m.result}</span>
            <span className="font-medium">{s.prize.label}</span>
            {s.prize.coupon_code && <code className="ml-1.5 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px]">{s.prize.coupon_code}</code>}
          </p>
        )}
        {answers.map(([key, value]) => (
          <p key={key} className="truncate"><span className="text-muted-foreground">{humanizeKey(key)}: </span>{String(value)}</p>
        ))}
        {!s.prize && answers.length === 0 && <p className="text-muted-foreground">{m.emailOnly}</p>}
      </div>

      <div className="min-w-0 space-y-1 text-xs text-muted-foreground">
        <p className="truncate" title={s.page_url}>{pathOf(s.page_url) || '—'}</p>
        <p className="truncate">
          {source || m.direct}{s.variant ? m.variant(s.variant.toUpperCase()) : ''}
        </p>
        {s.deliveries.length === 0 ? (
          <p>{m.notSent}</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {s.deliveries.map((d) => (
              <span key={d.id} className="inline-flex max-w-full items-center gap-1">
                <StatusBadge
                  {...describeDelivery(d)}
                  label={`${d.connection_name}: ${describeDelivery(d).label.toLowerCase()}`}
                  className="max-w-full truncate text-[10px]"
                />
                {onRetry && canRetry(d) && (
                  <button
                    type="button"
                    className="inline-flex items-center gap-0.5 rounded px-1 text-[10px] font-medium text-primary hover:underline disabled:opacity-50"
                    onClick={() => onRetry(d.id)}
                    disabled={retryingId === d.id}
                    aria-label={m.retryAria(d.connection_name)}
                  >
                    <RotateCcw className="h-3 w-3" aria-hidden />{m.retry}
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 md:justify-end">
        <time className="text-xs text-muted-foreground" dateTime={s.created_at} title={new Date(s.created_at).toLocaleString(locale === 'bn' ? 'bn-BD-u-nu-latn' : undefined)}>
          {relativeTime(s.created_at, now, t.errors.time)}
        </time>
        {canDelete && (
          <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-destructive" aria-label={m.deleteAria(s.email)} onClick={() => onDelete(s)} disabled={deleting}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </li>
  );
}
