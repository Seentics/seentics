import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { relativeTime } from '@/features/errors/format';
import type { Delivery } from '@/features/integrations/types';

const TONE: Record<Delivery['status'], string> = {
  success: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  failed: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  skipped: 'bg-muted text-muted-foreground',
};

/** What was sent to each destination lately, and how it went. Loading and empty states live here. */
/** `now` is for the demo, whose sample data is dated against a fixed clock. */
export function DeliveryLog({ deliveries, isLoading, now }: { deliveries: Delivery[]; isLoading?: boolean; now?: number }) {
  return (
    <div className="surface overflow-hidden">
      <div className="border-b border-border bg-muted/20 px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        Recent deliveries
      </div>
      {isLoading ? (
        [0, 1, 2].map((i) => <div key={i} className="border-b border-border px-4 py-3 last:border-0"><Skeleton className="h-4 w-full" /></div>)
      ) : deliveries.length === 0 ? (
        <p className="px-4 py-8 text-center text-xs text-muted-foreground">
          Nothing sent yet. Each new lead is delivered to your connected tools and listed here.
        </p>
      ) : (
        deliveries.map((d) => (
          <div key={d.id} className="flex items-center gap-3 border-b border-border px-4 py-2.5 text-sm last:border-0">
            <span className="w-24 shrink-0 truncate font-medium capitalize">{d.provider}</span>
            <Badge variant="outline" className={cn('w-16 shrink-0 justify-center border-0 capitalize', TONE[d.status])}>{d.status}</Badge>
            <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
              {d.error ?? (d.http_status ? `HTTP ${d.http_status}` : '')}
              {d.attempt_count > 1 ? ` · ${d.attempt_count} attempts` : ''}
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(d.created_at, now)}</span>
          </div>
        ))
      )}
    </div>
  );
}
