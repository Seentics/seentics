'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, Download, Inbox, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCards } from '@/components/seentics-ui/StatCards';
import { useRetryDelivery } from '@/features/integrations/mutations';
import { useIntegrations } from '@/features/integrations/queries';
import { submissionsApi } from '@/features/leads/api';
import { useDeleteSubmission } from '@/features/leads/mutations';
import { useFormSummary, useSubmissions } from '@/features/leads/queries';
import { SUBMISSION_RETENTION_DAYS as RETENTION_DAYS, describeRouting, type FormInfo } from '@/lib/form-routing';
import { isDemo } from '@/lib/demo';
import { DEMO_REFERENCE_DATE } from '@/lib/demo/fixture-utils';
import { topVariant } from '@/lib/submission-display';
import { SubmissionRow } from './SubmissionRow';

const PAGE_SIZE = 25;

export interface FormSubmissionsProps {
  websiteId: string;
  automationId: string;
  form: FormInfo;
}

/**
 * The Submissions section of a form automation's page: a four-card summary, where submissions
 * are being sent, and the list itself (search, export, delete).
 *
 * One form's view. Every form's submissions together, and the contacts they became, are on the
 * Leads page, which this links to. Submissions are kept for a fixed period; contacts until deleted.
 */
export function FormSubmissions({ websiteId, automationId, form }: FormSubmissionsProps) {
  const demo = isDemo(websiteId);
  const now = demo ? DEMO_REFERENCE_DATE.getTime() : undefined;
  const [confirm, confirmDialog] = useConfirm();
  const [search, setSearch] = useState('');
  const [offset, setOffset] = useState(0);
  const [exporting, setExporting] = useState(false);

  const filters = { search: search.trim(), limit: PAGE_SIZE, offset };
  const list = useSubmissions(websiteId, automationId, filters);
  const summary = useFormSummary(websiteId, automationId);
  const integrations = useIntegrations(websiteId);
  const remove = useDeleteSubmission(websiteId, automationId);
  const retry = useRetryDelivery(websiteId);

  const total = list.data?.total ?? 0;
  const submissions = list.data?.submissions ?? [];
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + PAGE_SIZE, total);
  const routing = integrations.data ? describeRouting(form.destinations, integrations.data.connections) : null;
  const top = topVariant(summary.data?.by_variant ?? []);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const blob = await submissionsApi.exportCsv(websiteId, automationId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `submissions-${automationId}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Could not export the submissions. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="mt-8 space-y-4" aria-labelledby="submissions-heading">
      {confirmDialog}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="submissions-heading" className="text-base font-semibold">Submissions</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Everything visitors sent through this form, kept for {RETENTION_DAYS} days and sent on to your destinations.
          </p>
        </div>
        <Link href={`/websites/${websiteId}/leads`} className="text-xs font-medium text-muted-foreground hover:text-foreground">
          See all leads →
        </Link>
      </div>

      <StatCards
        isLoading={summary.isLoading}
        cards={[
          { label: 'Submissions', value: summary.data?.total ?? 0 },
          { label: 'Last 7 days', value: summary.data?.last_7_days ?? 0 },
          { label: 'Last 30 days', value: summary.data?.last_30_days ?? 0 },
          form.hasRewards
            ? { label: 'Prizes won', value: summary.data?.with_prize ?? 0 }
            : { label: 'Top variant', value: top ? top.label : '—', subtext: top ? `${top.count} submissions` : 'No A/B test running' },
        ]}
      />

      {routing?.warning && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300" role="alert">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            {routing.warning}{' '}
            <Link href={`/websites/${websiteId}/settings/integrations`} className="font-medium underline underline-offset-2">Manage destinations</Link>
          </p>
        </div>
      )}

      <div className="surface overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border bg-muted/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={search} onChange={(e) => { setSearch(e.target.value); setOffset(0); }}
              placeholder="Search by name or email" aria-label="Search submissions" className="h-9 pl-8"
            />
          </div>
          <Button size="sm" variant="outline" className="h-9 gap-1.5 self-start sm:self-auto" onClick={() => void exportCsv()} disabled={exporting || total === 0}>
            <Download className="h-3.5 w-3.5" aria-hidden />{exporting ? 'Exporting…' : 'Export CSV'}
          </Button>
        </div>

        {list.isLoading ? (
          [0, 1, 2, 3].map((i) => <div key={i} className="border-b border-border px-4 py-4 last:border-0"><Skeleton className="h-4 w-full" /></div>)
        ) : submissions.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-14 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-muted"><Inbox className="h-5 w-5 text-muted-foreground" aria-hidden /></span>
            <p className="mt-3 text-sm font-medium">{filters.search ? 'No submissions match' : 'No submissions yet'}</p>
            <p className="mt-1 max-w-sm text-xs text-muted-foreground">
              {filters.search
                ? 'Try a different name or email.'
                : 'When a visitor fills in this form it appears here, then goes to your destinations.'}
            </p>
          </div>
        ) : (
          <ul>
            {submissions.map((s) => (
              <SubmissionRow
                key={s.id}
                submission={s}
                now={now}
                canDelete={!demo}
                deleting={remove.isPending}
                onRetry={demo ? undefined : (id) => retry.mutate(id, { onError: () => toast.error('Could not retry. Check that the destination is switched on.') })}
                retryingId={retry.isPending ? retry.variables : null}
                onDelete={async (sub) => {
                  const ok = await confirm({
                    title: `Delete the submission from ${sub.email}?`,
                    description: 'It is removed from here and from the queue if it has not been sent yet. Anything already delivered stays in the destination.',
                    confirmLabel: 'Delete submission',
                    destructive: true,
                  });
                  if (ok) remove.mutate(sub.id, { onError: () => toast.error('Could not delete the submission.') });
                }}
              />
            ))}
          </ul>
        )}

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
            <span>{from}–{to} of {total}</span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-8" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>Previous</Button>
              <Button size="sm" variant="outline" className="h-8" disabled={to >= total} onClick={() => setOffset(offset + PAGE_SIZE)}>Next</Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
