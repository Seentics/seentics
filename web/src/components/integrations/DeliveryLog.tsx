import { Loader2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { relativeTime } from '@/features/errors/format';
import { canRetry, describeDelivery } from '@/lib/integration-form';
import { useT, type Messages } from '@/lib/i18n';
import type { Delivery } from '@/features/integrations/types';
import { StatusBadge } from './StatusBadge';

type IntegrationsT = Messages['settings']['integrations'];

/** How long until a moment, as `untilTime` in lib/integration-form, in the current language. */
function until(iso: string, now: number = Date.now(), t: IntegrationsT): string {
  const at = new Date(iso).getTime();
  if (!Number.isFinite(at)) return '';
  const secs = Math.round((at - now) / 1000);
  if (secs <= 0) return t.now;
  if (secs < 60) return t.inSeconds(secs);
  const mins = Math.round(secs / 60);
  if (mins < 60) return t.inMinutes(mins);
  const hours = Math.round(mins / 60);
  if (hours < 24) return t.inHours(hours);
  return t.inDays(Math.round(hours / 24));
}

/** The detail line under a delivery: why it failed, when the next try is, or what the server said. */
function detail(d: Delivery, now: number | undefined, t: IntegrationsT): string {
  const parts: string[] = [];
  if (d.error) parts.push(d.error);
  else if (d.http_status) parts.push(`HTTP ${d.http_status}`);
  if (d.status === 'pending' && d.next_attempt_at) parts.push(t.nextTry(until(d.next_attempt_at, now, t)));
  if (d.attempt_count > 1) parts.push(t.attempts(d.attempt_count));
  return parts.join(' · ');
}

export interface DeliveryLogProps {
  deliveries: Delivery[];
  isLoading?: boolean;
  /** For the demo, whose sample data is dated against a fixed clock. */
  now?: number;
  /** Omitted for viewers: nothing that changes state is offered. */
  onRetry?: (delivery: Delivery) => void;
  retryingId?: string | null;
}

/**
 * What was sent to each destination lately, and how it went. Deliveries are retried
 * automatically; one that gave up shows Retry. Loading and empty states live here.
 */
export function DeliveryLog({ deliveries, isLoading, now, onRetry, retryingId }: DeliveryLogProps) {
  const tAll = useT();
  const t = tAll.settings.integrations;
  return (
    <section className="surface overflow-hidden" aria-label={t.recent}>
      <div className="border-b border-border bg-muted/20 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {t.recent}
      </div>
      {isLoading ? (
        [0, 1, 2].map((i) => <div key={i} className="border-b border-border px-4 py-3 last:border-0"><Skeleton className="h-4 w-full" /></div>)
      ) : deliveries.length === 0 ? (
        <p className="px-4 py-8 text-center text-xs text-muted-foreground">
          {t.emptyLog}
        </p>
      ) : (
        deliveries.map((d) => {
          const state = describeDelivery(d);
          const line = detail(d, now, t);
          return (
            <div key={d.id} className="flex items-center gap-3 border-b border-border px-4 py-2.5 text-sm last:border-0">
              <span className="w-36 shrink-0 truncate font-medium" title={d.connection_name}>{d.connection_name}</span>
              <StatusBadge {...state} label={t.status[state.label] ?? state.label} className="w-20 justify-center" />
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" title={line}>{line}</span>
              {onRetry && canRetry(d) && (
                <Button size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs" onClick={() => onRetry(d)} disabled={retryingId === d.id}>
                  {retryingId === d.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" aria-hidden />}{t.retry}
                </Button>
              )}
              <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(d.created_at, now, tAll.errors.time)}</span>
            </div>
          );
        })
      )}
    </section>
  );
}
