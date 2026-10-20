'use client';

/** One connected platform: is it healthy, what did it send this week, and its controls. */
import { MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';
import type { Destination } from '@/features/conversions/types';
import { cn } from '@/lib/utils';
import { PLATFORMS } from './conversion-format';
import { useT } from '@/lib/i18n';
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
  const all = useT();
  const t = all.conversions.card;
  const info = PLATFORMS[d.platform];
  const healthy = d.enabled && d.status === 'active';
  const stateLabel = !d.enabled ? t.paused : d.status === 'error' ? t.needsAttention : t.sending;

  return (
    // One slim row: logo, name and ID, the switch and the menu. A failure's reason is on the
    // status's hover.
    <article className="surface flex items-center gap-2.5 px-3 py-2.5" aria-label={`${info.label} — ${stateLabel}`}>
      <PlatformMark platform={d.platform} className="h-8 w-8 rounded-md" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-[13.5px] font-semibold leading-tight text-foreground">
          <span className="truncate">{d.name || info.label}</span>
          {healthy && <span className="size-1.5 shrink-0 rounded-full bg-emerald-500" title={stateLabel} aria-hidden />}
        </p>
        <p className="truncate font-mono text-[11px] text-muted-foreground">{d.credentials_hint}</p>
      </div>
      {/* Sending is the green dot by the name; paused or failing says so in words. */}
      {!healthy && (
        <span
          className={cn('flex shrink-0 items-center gap-1.5 text-[12px]', d.enabled ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground')}
          title={d.status === 'error' && d.last_error ? d.last_error : undefined}
        >
          <span className={cn('h-1.5 w-1.5 rounded-full', d.enabled ? 'bg-rose-500' : 'bg-muted-foreground/50')} aria-hidden />
          {stateLabel}
        </span>
      )}
      <Switch
        checked={d.enabled}
        onCheckedChange={onToggle}
        disabled={!canEdit}
        aria-label={d.enabled ? t.pause(info.label) : t.resume(info.label)}
        className="shrink-0 scale-90"
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="-mr-1 h-7 w-7 shrink-0 text-muted-foreground" aria-label={t.options(info.label)}>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onSelect={() => onAction('test')} disabled={!canEdit}>{t.sendTest}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onAction('events')} disabled={!canEdit}>{t.editEvents}</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => onAction('credentials')} disabled={!canEdit}>{t.editCredentials}</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => onAction('delete')} disabled={!canEdit} className="text-destructive focus:text-destructive">
            {t.disconnect}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </article>
  );
}
