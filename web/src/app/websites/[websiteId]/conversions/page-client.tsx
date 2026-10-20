'use client';

import { usePathSegment } from '@/lib/path-segment';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { ConnectDialog, type ConnectMode } from '@/components/conversions/ConnectDialog';
import { ConversionStats } from '@/components/conversions/ConversionsOverview';
import { PLATFORM_ORDER, PLATFORMS } from '@/components/conversions/conversion-format';
import { DestinationCard, type CardAction } from '@/components/conversions/DestinationCard';
import { EmptyState } from '@/components/conversions/EmptyState';
import { EventsTable } from '@/components/conversions/EventsTable';
import { PlatformMark } from '@/components/conversions/parts';
import { TestEventDialog } from '@/components/conversions/TestEventDialog';
import { LIST_PAGE, PageBar } from '@/components/ui/linear-list';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { RangeSelect } from '@/components/ui/range-select';
import { Skeleton } from '@/components/ui/skeleton';
import { useDeleteDestination, useUpdateDestination } from '@/features/conversions/mutations';
import { useDestinations } from '@/features/conversions/queries';
import type { Destination } from '@/features/conversions/types';
import { usePermissions } from '@/hooks/use-permissions';
import { isDemo } from '@/lib/demo';
import { DEMO_REFERENCE_DATE } from '@/lib/demo/fixture-utils';
import { useT } from '@/lib/i18n';

/**
 * Route composition only: the connected platforms as cards, then every conversion sent, in a
 * table with a tab per status as its top row — the list-page layout. Pieces are under
 * `components/conversions`; data lives in `features/conversions`.
 */

/** The date range's presets: the events kept, in rolling windows. */
const RANGES = [{ days: 7 }, { days: 30 }, { days: 90 }];

export default function ConversionsPage() {
  const t = useT().conversions.page;
  const websiteId = usePathSegment(1) ?? '';
  const demo = isDemo(websiteId);
  const now = demo ? DEMO_REFERENCE_DATE.getTime() : undefined;
  const { canEdit: canEditRole } = usePermissions(websiteId);
  // The demo shows every control; its writes answer with the demo notice instead of saving.
  const canEdit = canEditRole || demo;

  const [mode, setMode] = useState<ConnectMode | null>(null);
  const [testing, setTesting] = useState<Destination | null>(null);
  /** The events table's window, in days. */
  const [days, setDays] = useState(30);
  const [confirm, confirmDialog] = useConfirm();

  const destinations = useDestinations(websiteId);
  const list = destinations.data ?? [];
  const connected = list.length > 0;
  const update = useUpdateDestination(websiteId);
  const remove = useDeleteDestination(websiteId);

  const onAction = async (d: Destination, action: CardAction) => {
    if (action === 'test') return setTesting(d);
    if (action === 'events' || action === 'credentials') return setMode({ kind: action, destination: d });
    const label = d.name || PLATFORMS[d.platform].label;
    const ok = await confirm({
      title: t.disconnectTitle(label),
      description: t.disconnectBody,
      confirmLabel: t.disconnect,
      destructive: true,
    });
    if (ok) remove.mutate(d.id, { onSuccess: () => toast.success(t.disconnected(label)), onError: () => toast.error(t.disconnectFailed) });
  };

  const connectMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button className="h-8 gap-1.5 px-3 text-[13px]" disabled={!canEdit}><Plus className="h-3.5 w-3.5" />{t.connectPlatform}</Button>
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
    <div className={LIST_PAGE}>
      {confirmDialog}
      <PageBar title={t.title} description={t.intro}>
        {connected && <RangeSelect value={days} onChange={setDays} ranges={RANGES} />}
        {connectMenu}
      </PageBar>

      {destinations.isLoading ? (
        <div className="grid gap-3 px-3 pt-4 sm:grid-cols-2 md:px-4 xl:grid-cols-4">
          <Skeleton className="h-[164px] rounded-lg" />
          <Skeleton className="h-[164px] rounded-lg" />
        </div>
      ) : !connected ? (
        <div className="mx-auto w-full max-w-[1440px] p-4 md:p-5 lg:px-6 lg:py-5">
          <EmptyState canEdit={canEdit} onConnect={(platform) => setMode({ kind: 'connect', platform })} />
        </div>
      ) : (
        <>
          {/* The platforms first: each card is its connection's health and controls. */}
          {/* Lined up with the table panel under it (its 12 / 16px inset), no rule between them. */}
          <section aria-label={t.platforms} className="grid gap-3 px-3 pt-4 sm:grid-cols-2 md:px-4 xl:grid-cols-4">
            {list.map((d) => (
              <DestinationCard
                key={d.id}
                destination={d}
                now={now}
                canEdit={canEdit}
                onToggle={(enabled) => update.mutate(
                  { id: d.id, patch: { enabled } },
                  { onError: () => toast.error(t.toggleFailed) },
                )}
                onAction={(a) => void onAction(d, a)}
              />
            ))}
          </section>
          {/* What people come for first: each platform, the counts (more on demand), every event. */}
          <ConversionStats websiteId={websiteId} days={days} />
          <EventsTable websiteId={websiteId} destinations={list} now={now} canEdit={canEdit} days={days} />
        </>
      )}

      <ConnectDialog websiteId={websiteId} mode={mode} onClose={() => setMode(null)} />
      <TestEventDialog websiteId={websiteId} destination={testing} onClose={() => setTesting(null)} />
    </div>
  );
}
