'use client';

/** One connected platform: is it healthy, what did it send this week, and its controls. */
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import { relativeTime } from '@/features/errors/format';
import type { Destination } from '@/features/conversions/types';
import { cn } from '@/lib/utils';
import { PLATFORMS } from './conversion-format';
import { PlatformMark } from './parts';

export type CardAction = 'test' | 'events' | 'credentials' | 'delete';

export function DestinationCard({
  destination: d, now, canEdit, onToggle, onAction,
}: {
  destination: Destination;
  now?: number;
  canEdit: boolean;
  onToggle: (enabled: boolean) => void;
  onAction: (action: CardAction) => void;
}) {
  const info = PLATFORMS[d.platform];
  const healthy = d.enabled && d.status === 'active';
  const stateLabel = !d.enabled ? 'Paused' : d.status === 'error' ? 'Needs attention' : 'Sending';

  return (
    <article className="surface flex flex-col gap-4 p-4" aria-label={`${info.label} — ${stateLabel}`}>
      <header className="flex items-start gap-3">
        <PlatformMark platform={d.platform} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-foreground">{d.name || info.label}</p>
          <p className="truncate font-mono text-[11px] text-muted-foreground">{d.credentials_hint}</p>
        </div>
        <Switch checked={d.enabled} onCheckedChange={onToggle} disabled={!canEdit} aria-label={d.enabled ? `Pause ${info.label}` : `Resume ${info.label}`} />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="-mr-1 h-7 w-7 text-muted-foreground" aria-label={`${info.label} options`}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onSelect={() => onAction('test')} disabled={!canEdit}>Send test event</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onAction('events')} disabled={!canEdit}>Edit events</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => onAction('credentials')} disabled={!canEdit}>Edit credentials</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => onAction('delete')} disabled={!canEdit} className="text-destructive focus:text-destructive">
              Disconnect
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <dl className="grid grid-cols-3 gap-3">
        <div>
          <dt className="text-[11px] text-muted-foreground">Sent · 7 days</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums text-foreground">{d.stats.sent_7d.toLocaleString()}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-muted-foreground">Failed</dt>
          <dd className={cn('mt-0.5 text-lg font-semibold tabular-nums', d.stats.failed_7d ? 'text-rose-600 dark:text-rose-400' : 'text-foreground')}>
            {d.stats.failed_7d.toLocaleString()}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-muted-foreground">Last sent</dt>
          <dd className="mt-1 text-[13px] text-foreground/80">{d.stats.last_sent_at ? relativeTime(d.stats.last_sent_at, now) : '—'}</dd>
        </div>
      </dl>

      <footer className="flex items-start gap-2 border-t border-border pt-3 text-xs">
        <span className={cn('mt-1 h-1.5 w-1.5 shrink-0 rounded-full', healthy ? 'bg-emerald-500' : !d.enabled ? 'bg-muted-foreground/50' : 'bg-rose-500')} aria-hidden />
        <span className={cn('min-w-0', d.status === 'error' && d.enabled ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground')}>
          {stateLabel}
          {d.status === 'error' && d.last_error ? ` — ${d.last_error}` : ''}
        </span>
      </footer>
    </article>
  );
}
