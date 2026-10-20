import { Loader2, Pencil, Send, Unplug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { relativeTime } from '@/features/errors/format';
import { describeConnection } from '@/lib/integration-form';
import type { Connection, Provider } from '@/features/integrations/types';
import { cn } from '@/lib/utils';
import { destinationBrand, ProviderIcon } from './ProviderIcon';
import { useT } from '@/lib/i18n';

export interface DestinationCardProps {
  connection: Connection;
  provider: Provider | undefined;
  /** Viewers only look: nothing that changes or contacts the provider is offered. */
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

const DOT = { success: 'bg-emerald-500', warning: 'bg-amber-500', danger: 'bg-rose-500', muted: 'bg-muted-foreground/50' } as const;

/**
 * One connected destination, laid out as the Conversions platform cards are: its logo, name and
 * where it sends, the on/off switch; a status line (how it is doing, when it last worked, what is
 * still waiting); the last error if it stopped; then Send test, Edit and Disconnect.
 */
export function DestinationCard({ connection: c, provider, canEdit, busy, testing, now, onEdit, onTest, onToggle, onRemove }: DestinationCardProps) {
  const status = describeConnection(c);
  const tAll = useT();
  const t = tAll.settings.integrations;
  // A webhook says where it goes (Slack, Make, a host); the other kinds name their provider.
  const brand = destinationBrand(c.provider, c.credentials_hint);
  const where = c.provider === 'zapier' ? brand.label ?? t.webhook : provider?.label ?? c.provider;
  // The credential's last characters (the hint's tail, after a webhook's host): to tell two apart.
  const tail = c.credentials_hint ? `…${c.credentials_hint.trim().split(/\s+/).pop()!.replace(/^…/, '')}` : '';
  return (
    <article className="surface flex flex-col gap-3.5 p-4">
      <header className="flex items-start gap-3">
        <ProviderIcon provider={c.provider} hint={c.credentials_hint} className="h-10 w-10" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[14px] font-semibold text-foreground">{c.name}</h3>
          <p className="truncate text-[12.5px] text-muted-foreground">
            {where}{tail && <> · <span className="font-mono text-[11.5px]" title={t.credential}>{tail}</span></>}
          </p>
        </div>
        {canEdit && <Switch checked={c.enabled} onCheckedChange={onToggle} disabled={busy} aria-label={t.enabledAria(c.name)} />}
      </header>

      <p className="flex items-center gap-2 text-[13px]">
        <span className={cn('h-2 w-2 shrink-0 rounded-full', DOT[status.tone])} aria-hidden />
        <span className="font-medium text-foreground">{t.status[status.label] ?? status.label}</span>
        <span className="text-muted-foreground">
          · {t.lastSuccess} {c.last_success_at ? relativeTime(c.last_success_at, now, tAll.errors.time) : t.never}
          {c.pending_count > 0 ? ` · ${t.waiting} ${c.pending_count}` : ''}
        </span>
      </p>

      {c.last_error && (
        <p className="rounded-md bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700 dark:bg-rose-500/10 dark:text-rose-400" role="alert">
          {c.status === 'error' ? t.pausedAfterFailures : ''}{t.lastError(c.last_error)}
        </p>
      )}

      {canEdit && (
        <footer className="mt-auto flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-3">
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={onTest} disabled={busy || testing}>
            {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}{t.sendTest}
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={onEdit} disabled={busy}>
            <Pencil className="h-3.5 w-3.5" />{tAll.actions.edit}
          </Button>
          <Button size="sm" variant="ghost" className="ml-auto h-8 gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={onRemove} disabled={busy}>
            <Unplug className="h-3.5 w-3.5" />{t.disconnect}
          </Button>
        </footer>
      )}
    </article>
  );
}
