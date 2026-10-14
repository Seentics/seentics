import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { relativeTime } from '@/features/errors/format';
import { describeConnection } from '@/lib/integration-form';
import type { Connection, Provider } from '@/features/integrations/types';
import { ProviderIcon } from './ProviderIcon';
import { StatusBadge } from './StatusBadge';

export interface DestinationCardProps {
  connection: Connection;
  provider: Provider | undefined;
  /** Read-only for viewers and the demo: nothing that changes or contacts the provider is offered. */
  canEdit: boolean;
  busy?: boolean;
  testing?: boolean;
  /** For the demo, whose sample data is dated against a fixed clock. */
  now?: number;
  onEdit: () => void;
  onTest: () => void;
  onToggle: (enabled: boolean) => void;
  onRemove: () => void;
}

/**
 * One destination and its state: whether it is on, how many deliveries are still waiting, when
 * it last worked, and the last error if it stopped. A key is only ever shown as its last characters.
 */
export function DestinationCard({ connection: c, provider, canEdit, busy, testing, now, onEdit, onTest, onToggle, onRemove }: DestinationCardProps) {
  const status = describeConnection(c);
  return (
    <div className="surface flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <ProviderIcon provider={c.provider} />
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">{c.name}</h3>
            <p className="truncate text-xs text-muted-foreground">{provider?.label ?? c.provider}</p>
          </div>
        </div>
        <StatusBadge {...status} />
      </div>

      <dl className="space-y-1 text-xs text-muted-foreground">
        {c.credentials_hint && <div className="flex justify-between"><dt>Credential</dt><dd className="font-mono">…{c.credentials_hint}</dd></div>}
        <div className="flex justify-between"><dt>Last success</dt><dd>{c.last_success_at ? relativeTime(c.last_success_at, now) : 'Never'}</dd></div>
        {c.pending_count > 0 && (
          <div className="flex justify-between"><dt>Waiting to be sent</dt><dd className="tabular-nums">{c.pending_count}</dd></div>
        )}
      </dl>

      {c.last_error && (
        <p className="rounded-md bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-400" role="alert">
          {c.status === 'error' ? 'Paused after repeated failures. Waiting submissions are kept and sent once you turn it back on. ' : ''}Last error: {c.last_error}
        </p>
      )}

      {canEdit && (
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          <Button size="sm" variant="outline" onClick={onEdit} disabled={busy}>Edit</Button>
          <Button size="sm" variant="outline" onClick={onTest} disabled={busy || testing}>
            {testing && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}Send test
          </Button>
          <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={onRemove} disabled={busy}>Delete</Button>
          <label className="ml-auto flex items-center gap-2 text-xs">
            {c.enabled ? 'On' : 'Off'}
            <Switch checked={c.enabled} onCheckedChange={onToggle} disabled={busy} aria-label={`${c.name} enabled`} />
          </label>
        </div>
      )}
    </div>
  );
}
