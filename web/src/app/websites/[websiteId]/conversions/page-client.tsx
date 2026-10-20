'use client';

import { usePathSegment } from '@/lib/path-segment';

import { useState } from 'react';
import { Plus, Send } from 'lucide-react';
import { toast } from 'sonner';
import { ConnectDialog, type ConnectMode } from '@/components/conversions/ConnectDialog';
import { PLATFORM_ORDER, PLATFORMS, percent } from '@/components/conversions/conversion-format';
import { DailyChart } from '@/components/conversions/DailyChart';
import { DestinationCard, type CardAction } from '@/components/conversions/DestinationCard';
import { EmptyState } from '@/components/conversions/EmptyState';
import { EventsTable } from '@/components/conversions/EventsTable';
import { MatchQuality } from '@/components/conversions/MatchQuality';
import { PlatformMark } from '@/components/conversions/parts';
import { TestEventDialog } from '@/components/conversions/TestEventDialog';
import { ReportPage } from '@/components/ui/linear-list';
import { StatCards } from '@/components/seentics-ui/StatCards';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { RangeSelect } from '@/components/ui/range-select';
import { Skeleton } from '@/components/ui/skeleton';
import { useDeleteDestination, useUpdateDestination } from '@/features/conversions/mutations';
import { useConversionSummary, useDestinations } from '@/features/conversions/queries';
import type { Destination } from '@/features/conversions/types';
import { usePermissions } from '@/hooks/use-permissions';
import { isDemo } from '@/lib/demo';
import { DEMO_REFERENCE_DATE } from '@/lib/demo/fixture-utils';

/**
 * Route composition only: the platform cards, the period's figures, the chart, match quality and
 * the events list, with the connect, test and disconnect dialogs. Pieces are under
 * `components/conversions`; data lives in `features/conversions`.
 */

const RANGES = [
  { days: 7, label: 'Last 7 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
] as const;

export default function ConversionsPage() {
  const websiteId = usePathSegment(1) ?? '';
  const demo = isDemo(websiteId);
  const now = demo ? DEMO_REFERENCE_DATE.getTime() : undefined;
  const { canEdit: canEditRole } = usePermissions(websiteId);
  // The demo shows every control; its writes answer with the demo notice instead of saving.
  const canEdit = canEditRole || demo;

  const [days, setDays] = useState(30);
  const [mode, setMode] = useState<ConnectMode | null>(null);
  const [testing, setTesting] = useState<Destination | null>(null);
  const [confirm, confirmDialog] = useConfirm();

  const destinations = useDestinations(websiteId);
  const list = destinations.data ?? [];
  const connected = list.length > 0;
  const summary = useConversionSummary(websiteId, days, connected);
  const update = useUpdateDestination(websiteId);
  const remove = useDeleteDestination(websiteId);

  const totals = summary.data?.totals;
  const figure = (n: number | undefined) => (n === undefined ? '—' : n.toLocaleString());
  const settled = totals ? totals.accepted + totals.failed : 0;

  const onAction = async (d: Destination, action: CardAction) => {
    if (action === 'test') return setTesting(d);
    if (action === 'events' || action === 'credentials') return setMode({ kind: action, destination: d });
    const label = d.name || PLATFORMS[d.platform].label;
    const ok = await confirm({
      title: `Disconnect ${label}?`,
      description: 'Conversions stop being sent to it. Anything already sent stays on the platform; its credentials are deleted from Seentics.',
      confirmLabel: 'Disconnect',
      destructive: true,
    });
    if (ok) remove.mutate(d.id, { onSuccess: () => toast.success(`${label} disconnected`), onError: () => toast.error('Could not disconnect. Please try again.') });
  };

  const connectMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="h-8 gap-1.5 px-3 text-xs" disabled={!canEdit}><Plus className="h-3.5 w-3.5" />Connect platform</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {PLATFORM_ORDER.map((key) => (
          <DropdownMenuItem key={key} onSelect={() => setMode({ kind: 'connect', platform: key })} className="gap-2.5">
            <PlatformMark platform={key} className="h-7 w-7" />
            <span className="min-w-0 flex-1 truncate">{PLATFORMS[key].label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <ReportPage
      icon={<Send />}
      title="Conversions"
      description="Your sales and leads, sent from Seentics' servers to your ad platforms — so ad blockers and browsers can't drop them."
      websiteId={websiteId}
      actions={<>
        {connected && <RangeSelect value={days} onChange={setDays} ranges={RANGES} />}
        {connectMenu}
      </>}
    >
      {confirmDialog}

      {destinations.isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Skeleton className="h-[164px] rounded-lg" />
          <Skeleton className="h-[164px] rounded-lg" />
        </div>
      ) : !connected ? (
        <EmptyState canEdit={canEdit} onConnect={(platform) => setMode({ kind: 'connect', platform })} />
      ) : (
        <div className="space-y-5">
          <section aria-label="Platforms" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {list.map((d) => (
              <DestinationCard
                key={d.id}
                destination={d}
                now={now}
                canEdit={canEdit}
                onToggle={(enabled) => update.mutate(
                  { id: d.id, patch: { enabled } },
                  { onError: () => toast.error('Could not change it. Please try again.') },
                )}
                onAction={(a) => void onAction(d, a)}
              />
            ))}
          </section>

          <StatCards
            className="mb-0"
            cards={[
              { label: 'Sent', value: figure(totals?.sent), subtext: RANGES.find((r) => r.days === days)?.label },
              {
                label: 'Accepted',
                value: totals ? `${percent(totals.accepted, settled)}%` : '—',
                subtext: totals ? `${totals.accepted.toLocaleString()} conversions` : undefined,
              },
              { label: 'Failed', value: figure(totals?.failed), subtext: 'Retried for several hours first', tone: 'danger', toneWhen: (totals?.failed ?? 0) > 0 },
              { label: 'Sending', value: figure(totals?.pending), subtext: 'Usually seconds' },
            ]}
          />

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <section aria-labelledby="per-day" className="surface p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 id="per-day" className="text-sm font-semibold text-foreground">Sent per day</h2>
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground" aria-hidden>
                  <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-primary" />Accepted</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-rose-500/45" />Failed</span>
                </div>
              </div>
              {summary.data ? <DailyChart byDay={summary.data.by_day} /> : <Skeleton className="h-[180px] rounded-md" />}
            </section>
            <section aria-labelledby="match" className="surface p-4">
              <h2 id="match" className="mb-3 text-sm font-semibold text-foreground">How they were matched</h2>
              {summary.data ? <MatchQuality match={summary.data.match} /> : <Skeleton className="h-[180px] rounded-md" />}
            </section>
          </div>

          <EventsTable websiteId={websiteId} destinations={list} now={now} canEdit={canEdit} />
        </div>
      )}

      <ConnectDialog websiteId={websiteId} mode={mode} onClose={() => setMode(null)} />
      <TestEventDialog websiteId={websiteId} destination={testing} onClose={() => setTesting(null)} />
    </ReportPage>
  );
}
