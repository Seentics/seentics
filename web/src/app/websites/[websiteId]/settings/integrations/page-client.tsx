'use client';

import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { AddDestination } from '@/components/integrations/AddDestination';
import { ConnectDialog } from '@/components/integrations/ConnectDialog';
import { DeliveryLog } from '@/components/integrations/DeliveryLog';
import { DestinationCard } from '@/components/integrations/DestinationCard';
import {
  useCreateDestination, useRemoveDestination, useRetryDelivery, useTestDestination, useUpdateDestination,
} from '@/features/integrations/mutations';
import { useIntegrationDeliveries, useIntegrations } from '@/features/integrations/queries';
import type { Connection, Provider } from '@/features/integrations/types';
import { describeTest } from '@/lib/integration-form';
import { isDemo } from '@/lib/demo';
import { DEMO_REFERENCE_DATE } from '@/lib/demo/fixture-utils';
import { usePathSegment } from '@/lib/path-segment';

/** Which dialog is open: adding a provider, or editing a destination. */
type Editing = { provider: Provider; connection: Connection | null };

/**
 * Route composition only: which dialog is open and what the last test said. Data access is
 * `features/integrations`; the markup is components taking props.
 *
 * Whether the viewer may change things is the server's call (members and above). The buttons are
 * shown to everyone but the demo, and a viewer who presses one gets the server's refusal.
 */
export default function IntegrationsPage() {
  const websiteId = usePathSegment(1) ?? '';
  const demo = isDemo(websiteId);
  // Sample data is dated against a fixed clock; relative times read against it too.
  const now = demo ? DEMO_REFERENCE_DATE.getTime() : undefined;
  const [confirm, confirmDialog] = useConfirm();

  const { data, isLoading, error } = useIntegrations(websiteId);
  const providers = data?.providers ?? [];
  const connections = data?.connections ?? [];
  const deliveries = useIntegrationDeliveries(websiteId);
  const create = useCreateDestination(websiteId);
  const update = useUpdateDestination(websiteId);
  const remove = useRemoveDestination(websiteId);
  const test = useTestDestination(websiteId);
  const retry = useRetryDelivery(websiteId);

  const [editing, setEditing] = useState<Editing | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);

  const fail = (e: Error) => setNotice({ ok: false, message: e.message });
  const providerOf = (c: Connection) => providers.find((p) => p.id === c.provider);

  const runTest = async (c: Connection) => {
    const ok = await confirm({
      title: `Send a test to ${c.name}?`,
      description: 'It sends a sample submission for seentics-test@example.com. For list-based tools that adds a test contact you can delete afterwards.',
      confirmLabel: 'Send test',
    });
    if (!ok) return;
    setTesting(c.id);
    setNotice(null);
    try {
      setNotice(describeTest(await test.mutateAsync(c.id)));
    } catch (err) {
      fail(err instanceof Error ? err : new Error('The test failed.'));
    } finally {
      setTesting(null);
    }
  };

  const runRemove = async (c: Connection) => {
    const ok = await confirm({
      title: `Delete ${c.name}?`,
      description: 'Its saved credentials are deleted and submissions waiting for it are dropped. Forms that sent to it stop sending there; what it already received stays where it is.',
      confirmLabel: 'Delete destination',
      destructive: true,
    });
    if (ok) await remove.mutateAsync(c.id).catch(fail);
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <DashboardPageHeader
        title="Integrations"
        description="Where your forms send what visitors submit. Pick the destinations for each form in its settings. Credentials are encrypted and never shown again."
      />

      {demo && (
        <Alert><AlertDescription>Destinations can’t be changed on the demo site.</AlertDescription></Alert>
      )}
      {error && <Alert variant="destructive"><AlertDescription>{(error as Error).message}</AlertDescription></Alert>}
      {notice && (
        <Alert variant={notice.ok ? 'default' : 'destructive'} role="status"><AlertDescription>{notice.message}</AlertDescription></Alert>
      )}

      <section aria-labelledby="destinations">
        <div className="mb-2 flex items-baseline justify-between gap-3">
          <h2 id="destinations" className="text-sm font-semibold">Your destinations</h2>
          <span className="text-xs text-muted-foreground">Failed sends are retried automatically, over several hours.</span>
        </div>
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-36 animate-pulse rounded-xl bg-muted/50" />)}
          </div>
        ) : connections.length === 0 ? (
          <div className="surface px-4 py-8 text-center">
            <p className="text-sm font-medium">No destinations yet</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
              Submissions are still listed on each form’s page for 90 days. Add a destination below to send them to your email tool, CRM or a webhook as they arrive.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {connections.map((c) => (
              <DestinationCard
                key={c.id}
                connection={c}
                provider={providerOf(c)}
                canEdit={!demo}
                busy={update.isPending || remove.isPending}
                testing={testing === c.id}
                now={now}
                onEdit={() => { const provider = providerOf(c); if (provider) setEditing({ provider, connection: c }); }}
                onTest={() => void runTest(c)}
                onToggle={(enabled) => update.mutate({ connectionId: c.id, input: { enabled } }, { onError: fail })}
                onRemove={() => void runRemove(c)}
              />
            ))}
          </div>
        )}
      </section>

      {!isLoading && (
        <AddDestination providers={providers} count={connections.length} disabled={demo} onPick={(provider) => setEditing({ provider, connection: null })} />
      )}

      <DeliveryLog
        deliveries={deliveries.data ?? []}
        isLoading={deliveries.isLoading}
        now={now}
        onRetry={demo ? undefined : (d) => {
          setRetrying(d.id);
          retry.mutate(d.id, { onError: fail, onSettled: () => setRetrying(null) });
        }}
        retryingId={retrying}
      />

      <p className="text-xs text-muted-foreground">
        Each submission is delivered at least once: a destination that is down gets it again later, so a webhook may see the same
        submission twice. Use the <code className="rounded bg-muted px-1">Idempotency-Key</code> header to skip repeats.
      </p>

      {editing && (
        // Keyed so a dialog always opens with fresh, empty secret fields.
        <ConnectDialog
          key={`${editing.provider.id}-${editing.connection?.id ?? 'new'}`}
          provider={editing.provider}
          connection={editing.connection}
          existing={connections}
          open
          onOpenChange={(o) => { if (!o) setEditing(null); }}
          onSubmit={async (body, isEdit) => {
            if (isEdit && editing.connection) await update.mutateAsync({ connectionId: editing.connection.id, input: body as Parameters<typeof update.mutateAsync>[0]['input'] });
            else await create.mutateAsync(body as Parameters<typeof create.mutateAsync>[0]);
            setNotice({ ok: true, message: `${(body as { name?: string }).name || editing.provider.label} ${isEdit ? 'updated' : 'added'}.` });
          }}
        />
      )}
      {confirmDialog}
    </div>
  );
}
