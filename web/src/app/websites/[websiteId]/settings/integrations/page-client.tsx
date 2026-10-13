'use client';

import { useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DashboardPageHeader } from '@/components/dashboard-header';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { ConnectDialog } from '@/components/integrations/ConnectDialog';
import { DeliveryLog } from '@/components/integrations/DeliveryLog';
import { IntegrationCard } from '@/components/integrations/IntegrationCard';
import {
  useConnectIntegration, useDisconnectIntegration, useTestIntegration, useUpdateIntegration,
} from '@/features/integrations/mutations';
import { useIntegrationDeliveries, useIntegrations } from '@/features/integrations/queries';
import type { Provider } from '@/features/integrations/types';
import { describeTest } from '@/lib/integration-form';
import { isDemo } from '@/lib/demo';
import { DEMO_REFERENCE_DATE } from '@/lib/demo/fixture-utils';
import { usePathSegment } from '@/lib/path-segment';

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

  const { data: providers = [], isLoading, error } = useIntegrations(websiteId);
  const deliveries = useIntegrationDeliveries(websiteId);
  const connect = useConnectIntegration(websiteId);
  const update = useUpdateIntegration(websiteId);
  const disconnect = useDisconnectIntegration(websiteId);
  const test = useTestIntegration(websiteId);

  const [editing, setEditing] = useState<Provider | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const [testing, setTesting] = useState<string | null>(null);

  const runTest = async (p: Provider) => {
    const ok = await confirm({
      title: `Send a test lead to ${p.label}?`,
      description: 'It sends a sample lead for seentics-test@example.com. For list-based tools that adds a test contact you can delete afterwards.',
      confirmLabel: 'Send test',
    });
    if (!ok) return;
    setTesting(p.id);
    setNotice(null);
    try {
      setNotice(describeTest(await test.mutateAsync(p.id)));
    } catch (err) {
      setNotice({ ok: false, message: err instanceof Error ? err.message : 'The test failed.' });
    } finally {
      setTesting(null);
    }
  };

  const remove = async (p: Provider) => {
    const ok = await confirm({
      title: `Disconnect ${p.label}?`,
      description: 'Its saved credentials are deleted. New leads stop going there; contacts already sent stay where they are.',
      confirmLabel: 'Disconnect',
      destructive: true,
    });
    if (ok) await disconnect.mutateAsync(p.id).catch((e: Error) => setNotice({ ok: false, message: e.message }));
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-500">
      <DashboardPageHeader
        title="Integrations"
        description="Send each new lead to the tools you already use. Credentials are encrypted and never shown again."
      />

      {demo && (
        <Alert><AlertDescription>Integrations are not available on the demo site.</AlertDescription></Alert>
      )}
      {error && <Alert variant="destructive"><AlertDescription>{(error as Error).message}</AlertDescription></Alert>}
      {notice && (
        <Alert variant={notice.ok ? 'default' : 'destructive'} role="status"><AlertDescription>{notice.message}</AlertDescription></Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {isLoading
          ? [0, 1, 2, 3].map((i) => <div key={i} className="h-36 animate-pulse rounded-xl bg-muted/50" />)
          : providers.map((p) => (
              <IntegrationCard
                key={p.id}
                provider={p}
                canEdit={!demo}
                busy={update.isPending || disconnect.isPending}
                testing={testing === p.id}
                now={now}
                onConnect={() => setEditing(p)}
                onTest={() => void runTest(p)}
                onToggle={(enabled) => update.mutate({ provider: p.id, input: { enabled } }, { onError: (e) => setNotice({ ok: false, message: e.message }) })}
                onDisconnect={() => void remove(p)}
              />
            ))}
      </div>

      <DeliveryLog deliveries={deliveries.data ?? []} isLoading={deliveries.isLoading} now={now} />

      {editing && (
        // Keyed so a provider's dialog always opens with fresh, empty secret fields.
        <ConnectDialog
          key={`${editing.id}-${editing.connection ? 'edit' : 'new'}`}
          provider={editing}
          open
          onOpenChange={(o) => { if (!o) setEditing(null); }}
          onSubmit={async (body, isEdit) => {
            if (isEdit) await update.mutateAsync({ provider: editing.id, input: body });
            else await connect.mutateAsync({ provider: editing.id, input: body as Parameters<typeof connect.mutateAsync>[0]['input'] });
            setNotice({ ok: true, message: `${editing.label} ${isEdit ? 'updated' : 'connected'}.` });
          }}
        />
      )}
      {confirmDialog}
    </div>
  );
}
