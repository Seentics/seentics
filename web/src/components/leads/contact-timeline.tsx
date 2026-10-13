'use client';

import { useState } from 'react';
import { Check, Copy, ExternalLink, Gift, Link2, Megaphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { relativeTime } from '@/features/errors/format';
import { hostOf, humanizeKey, pathOf, splitAnswers } from '@/lib/lead-display';
import type { ContactSubmission } from '@/features/leads/types';

/** Copy text, and say so for a moment. A blocked clipboard simply leaves the label alone. */
function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable: nothing to confirm */ }
  };
  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={`Copy coupon code ${code}`}
      className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-amber-500/50 bg-amber-500/10 px-2 py-0.5 font-mono text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-500/20 dark:text-amber-300"
    >
      {code}
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

export interface ContactTimelineProps {
  submissions: ContactSubmission[];
  /** For the demo, whose sample data is dated against a fixed clock. */
  now?: number;
  className?: string;
}

/**
 * Every time this person filled a form, newest first, as a timeline.
 *
 * Each entry says which popup (and A/B variant) collected it, where they were, what they
 * answered, and — for a wheel or coupon — what they won. The attribution is why leads live
 * next to the analytics, so it is the headline of each entry, not a footnote.
 */
export function ContactTimeline({ submissions, now, className }: ContactTimelineProps) {
  if (!submissions.length) {
    return <p className={cn('px-4 py-8 text-center text-sm text-muted-foreground', className)}>No submissions recorded.</p>;
  }
  return (
    <ol className={cn('relative px-4 py-2', className)}>
      {submissions.map((s, i) => {
        const { prize, rest } = splitAnswers(s.fields);
        const referrer = hostOf(s.referrer);
        const last = i === submissions.length - 1;
        return (
          <li key={s.id} className="relative flex gap-3 pb-5 last:pb-2">
            {!last && <span aria-hidden className="absolute left-[13px] top-7 bottom-0 w-px bg-border" />}
            <span className="relative z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-muted/60">
              <Megaphone className="h-3.5 w-3.5 text-muted-foreground" />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-medium">{s.automation_name ?? 'Unknown popup'}</span>
                {s.variant && (
                  <span className="rounded-full bg-violet-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                    Variant {s.variant}
                  </span>
                )}
                <span className="ml-auto text-xs text-muted-foreground">{relativeTime(s.created_at, now)}</span>
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                {s.page_url && (
                  <a href={s.page_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-foreground">
                    <ExternalLink className="h-3 w-3" /> {pathOf(s.page_url)}
                  </a>
                )}
                <span className="inline-flex items-center gap-1">
                  <Link2 className="h-3 w-3" /> {referrer || 'Direct'}
                </span>
              </div>

              {prize && (
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
                  <Gift className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                  <span className="text-sm font-medium">{prize.label || 'Prize'}</span>
                  {prize.code && <CopyCode code={prize.code} />}
                </div>
              )}

              {rest.length > 0 && (
                <dl className="mt-2 flex flex-wrap gap-2">
                  {rest.map(([key, value]) => (
                    <div key={key} className="rounded-md border border-border bg-muted/40 px-2 py-1 text-xs">
                      <dt className="inline text-muted-foreground">{humanizeKey(key)}: </dt>
                      <dd className="inline break-words font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
