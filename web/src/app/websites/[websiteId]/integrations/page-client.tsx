'use client';

import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ReportPage } from '@/components/ui/linear-list';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { AddDestination } from '@/components/integrations/AddDestination';
import { ConnectDialog } from '@/components/integrations/ConnectDialog';
import { DeliveryLog } from '@/components/integrations/DeliveryLog';
import { DestinationCard } from '@/components/integrations/DestinationCard';
import {
  useCreateDestination, useRemoveDestination, useRetryDelivery, useTestDestination, useUpdateDestination,
} from '@/features/integrations/mutations';
import { useIntegrationDeliveries, useIntegrations } from '@/features/integrations/queries';
import type { Connection, Provider, TestOutcome } from '@/features/integrations/types';
import { isDemo } from '@/lib/demo';
import { DEMO_REFERENCE_DATE } from '@/lib/demo/fixture-utils';
import { usePermissions } from '@/hooks/use-permissions';
import { usePathSegment } from '@/lib/path-segment';
import { useT } from '@/lib/i18n';

/** Which dialog is open: adding a provider, or editing a destination. */
type Editing = { provider: Provider; connection: Connection | null };

/**
 * Route composition only: which dialog is open and what the last test said. Data access is
 * `features/integrations`; the markup is components taking props.
 *
 * Whether the viewer may change things is the server's call (members and above); the buttons are
 * shown to those who may. The demo shows them too, and each answers with its demo notice.
 */
export default function IntegrationsPage() {
  const websiteId = usePathSegment(1) ?? '';
  const demo = isDemo(websiteId);
  // Members and up change things; the demo shows every control and answers each with its demo notice.
  const { canEdit } = usePermissions(websiteId);
  // Sample data is dated against a fixed clock; relative times read against it too.
  const now = demo ? DEMO_REFERENCE_DATE.getTime() : undefined;
  const [confirm, confirmDialog] = useConfirm();
  const tAll = useT();
  const t = tAll.settings.integrationsPage;
  // As `describeTest` in lib/integration-form, in the current language.
  const describe = (outcome: TestOutcome): { ok: boolean; message: string } => {
    const ti = tAll.settings.integrations;
    switch (outcome.kind) {
      case 'ok': return { ok: true, message: ti.testSent };
      case 'skipped': return { ok: true, message: outcome.reason };
      case 'failed': return { ok: false, message: outcome.auth ? ti.rejected(outcome.message) : outcome.message };
    }
  };

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
      title: t.testTitle(c.name),
      description: t.testBody,
      confirmLabel: t.sendTest,
    });
    if (!ok) return;
    setTesting(c.id);
    setNotice(null);
    try {
      setNotice(describe(await test.mutateAsync(c.id)));
    } catch (err) {
      fail(err instanceof Error ? err : new Error(t.testFailed));
    } finally {
      setTesting(null);
    }
  };

  const runRemove = async (c: Connection) => {
    const ok = await confirm({
      title: t.deleteTitle(c.name),
      description: t.deleteBody,
      confirmLabel: t.deleteConfirm,
      destructive: true,
    });
    if (ok) await remove.mutateAsync(c.id).catch(fail);
  };

  return (
    // Its own page beside Conversions, in the same heading and frame as the other report pages.
    <ReportPage title={t.title} description={t.description} websiteId={websiteId} bodyClassName="space-y-6">

      {error && <Alert variant="destructive"><AlertDescription>{(error as Error).message}</AlertDescription></Alert>}
      {notice && (
        <Alert variant={notice.ok ? 'default' : 'destructive'} role="status"><AlertDescription>{notice.message}</AlertDescription></Alert>
      )}

      <section aria-labelledby="destinations">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 id="destinations" className="text-[15px] font-semibold">{t.yourDestinations}</h2>
          <span className="text-xs text-muted-foreground">{t.retried}</span>
        </div>
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => <div key={i} className="h-36 animate-pulse rounded-xl bg-muted/50" />)}
          </div>
        ) : connections.length === 0 ? (
          <div className="surface px-4 py-8 text-center">
            <p className="text-sm font-medium">{t.empty}</p>
            <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
              {t.emptyBody}
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {connections.map((c) => (
              <DestinationCard
                key={c.id}
                connection={c}
                provider={providerOf(c)}
                canEdit={canEdit}
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
        <AddDestination providers={providers} count={connections.length} disabled={!canEdit} onPick={(provider) => setEditing({ provider, connection: null })} />
      )}

      <DeliveryLog
        deliveries={deliveries.data ?? []}
        isLoading={deliveries.isLoading}
        now={now}
        // Retrying a delivery is a write the API refuses a viewer (403), so a viewer gets no button.
        onRetry={demo || !canEdit ? undefined : (d) => {
          setRetrying(d.id);
          retry.mutate(d.id, { onError: fail, onSettled: () => setRetrying(null) });
        }}
        retryingId={retrying}
      />

      <p className="text-xs text-muted-foreground">
        {t.atLeastOnceBefore}<code className="rounded bg-muted px-1">Idempotency-Key</code>{t.atLeastOnceAfter}
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
            const label = (body as { name?: string }).name || editing.provider.label;
            setNotice({ ok: true, message: isEdit ? t.updated(label) : t.added(label) });
          }}
        />
      )}
      {confirmDialog}
    </ReportPage>
  );
}
