import { Loader2, Mail, Plug, Send, Webhook, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { relativeTime } from '@/features/errors/format';
import { describeConnection, type StatusTone } from '@/lib/integration-form';
import type { Provider, ProviderId } from '@/features/integrations/types';

const ICONS: Record<ProviderId, React.ElementType> = { zapier: Webhook, mailchimp: Mail, klaviyo: Send, hubspot: Plug };

const TONE: Record<StatusTone, string> = {
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  warning: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  danger: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  muted: 'bg-muted text-muted-foreground',
};

export interface IntegrationCardProps {
  provider: Provider;
  /** Read-only for viewers: nothing that changes or contacts the provider is offered. */
  canEdit: boolean;
  busy?: boolean;
  testing?: boolean;
  onConnect: () => void;
  onTest: () => void;
  onToggle: (enabled: boolean) => void;
  onDisconnect: () => void;
}

/**
 * One provider and, if connected, its state: whether it is on, when it last worked, and the
 * last error if it stopped. A key is only ever shown as its last characters.
 */
export function IntegrationCard({ provider, canEdit, busy, testing, onConnect, onTest, onToggle, onDisconnect }: IntegrationCardProps) {
  const c = provider.connection;
  const status = describeConnection(c);
  const Icon = ICONS[provider.id] ?? Zap;

  return (
    <div className="surface flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted"><Icon className="h-4 w-4" /></span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">{provider.label}</h3>
            <p className="text-xs text-muted-foreground">{provider.description}</p>
          </div>
        </div>
        <Badge variant="outline" className={cn('shrink-0 border-0', TONE[status.tone])}>{status.label}</Badge>
      </div>

      {c && (
        <dl className="space-y-1 text-xs text-muted-foreground">
          {c.credentials_hint && <div className="flex justify-between"><dt>Credential</dt><dd className="font-mono">…{c.credentials_hint}</dd></div>}
          <div className="flex justify-between"><dt>Last success</dt><dd>{c.last_success_at ? relativeTime(c.last_success_at) : 'Never'}</dd></div>
        </dl>
      )}

      {c?.last_error && (
        <p className="rounded-md bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-400" role="alert">
          {c.status === 'error' ? 'Paused after repeated failures. ' : ''}Last error: {c.last_error}
        </p>
      )}

      {canEdit && (
        <div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
          {!c ? (
            <Button size="sm" onClick={onConnect}>Connect</Button>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={onConnect} disabled={busy}>Edit</Button>
              <Button size="sm" variant="outline" onClick={onTest} disabled={busy || testing}>
                {testing && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}Send test
              </Button>
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={onDisconnect} disabled={busy}>Disconnect</Button>
              <label className="ml-auto flex items-center gap-2 text-xs">
                {c.enabled ? 'On' : 'Off'}
                <Switch checked={c.enabled} onCheckedChange={onToggle} disabled={busy} aria-label={`${provider.label} enabled`} />
              </label>
            </>
          )}
        </div>
      )}
    </div>
  );
}
