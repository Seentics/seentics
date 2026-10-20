'use client';

import { ArrowRight, Check, Minus, RotateCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet';
import { relativeTime } from '@/features/errors/format';
import { useRetryConversion } from '@/features/conversions/mutations';
import { MATCH_KEYS, type ConversionEvent, type Destination } from '@/features/conversions/types';
import { useLocale, useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { formatValue, PLATFORMS } from './conversion-format';
import { PlatformMark, StatusLabel } from './parts';

/**
 * One conversion, opened from the events table: what happened on the site and what it was sent
 * to the platform as, how it went (and why not, with a retry), and which details it was matched
 * on. Laid out as the contact sheet is: a grey ground with white blocks on it, no outlines.
 */
export function EventDetailSheet({ websiteId, event, destinations, now, canEdit, onClose }: {
  websiteId: string;
  event: ConversionEvent | null;
  destinations: Destination[];
  now?: number;
  canEdit: boolean;
  onClose: () => void;
}) {
  const all = useT();
  const t = all.conversions.events;
  const { locale } = useLocale();
  const retry = useRetryConversion(websiteId);
  const fullDate = (iso: string) => new Date(iso).toLocaleString(locale === 'bn' ? 'bn-BD-u-nu-latn' : undefined);
  const ago = (iso: string) => relativeTime(iso, now, all.errors.time);

  return (
    <Sheet open={!!event} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-xl">
        <SheetTitle className="sr-only">{t.detailTitle}</SheetTitle>
        {event && (() => {
          const destination = destinations.find((d) => d.id === event.destination_id);
          const platform = PLATFORMS[event.platform].label;
          return (
            <div className="flex min-h-full flex-col">
              <header className="flex items-center gap-3.5 px-6 pb-5 pt-6 pr-14">
                <span aria-hidden className="flex size-11 shrink-0 items-center justify-center rounded-md bg-muted"><PlatformMark platform={event.platform} className="h-6 w-6" /></span>
                <div className="min-w-0">
                  <h2 className="flex min-w-0 items-center gap-1.5 text-lg font-semibold tracking-tight">
                    <span className="truncate font-mono">{event.event_name}</span>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-label={t.sentAs} />
                    <span className="truncate font-mono text-foreground/80">{event.platform_event || '—'}</span>
                  </h2>
                  <p className="truncate text-[13px] text-muted-foreground">{destination?.name || platform} · {all.conversions.kinds[event.kind]}</p>
                </div>
              </header>

              <div className="flex-1 space-y-4 bg-[hsl(var(--app-page))] px-6 py-5">
                <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Stat label={all.actions.status} value={<StatusLabel status={event.status} />} />
                  <Stat label={t.value} value={formatValue(event.value, event.currency)} />
                  <Stat label={t.attempts} value={event.attempt_count.toLocaleString()} />
                  <Stat label={t.created} value={ago(event.created_at)} />
                </dl>

                {event.error && (
                  <section className={cn('rounded-md p-4', event.status === 'failed' ? 'bg-rose-50 dark:bg-rose-500/10' : 'bg-card')}>
                    <h3 className="text-[14px] font-semibold text-foreground">{t.errorTitle}</h3>
                    <p className={cn('mt-1 text-[13px]', event.status === 'failed' ? 'text-rose-700 dark:text-rose-400' : 'text-foreground/80')}>{event.error}</p>
                    {event.status === 'failed' && canEdit && (
                      <Button
                        size="sm" variant="outline" className="mt-3 h-8 gap-1.5"
                        disabled={retry.isPending}
                        onClick={() => retry.mutate(event.id, {
                          onSuccess: () => { toast.success(t.retryQueued); onClose(); },
                          onError: () => toast.error(t.retryFailed),
                        })}
                      >
                        <RotateCw className="h-3.5 w-3.5" />{all.actions.retry}
                      </Button>
                    )}
                  </section>
                )}

                <section className="rounded-md bg-card">
                  <h3 className="px-4 pb-1 pt-3.5 text-[14px] font-semibold text-foreground">{t.details}</h3>
                  <dl className="divide-y divide-border/60 text-[13.5px]">
                    <Row label={t.event} value={<span className="font-mono">{event.event_name}</span>} />
                    <Row label={t.sentAs} value={<span className="font-mono">{event.platform_event || '—'}</span>} />
                    <Row label={t.destination} value={destination?.name ? `${destination.name} · ${platform}` : platform} />
                    <Row label={t.kind} value={all.conversions.kinds[event.kind]} />
                    {event.order_id && <Row label={t.orderId} value={<span className="font-mono">{event.order_id}</span>} />}
                    <Row label={t.created} value={fullDate(event.created_at)} />
                    <Row label={t.completed} value={event.completed_at ? fullDate(event.completed_at) : '—'} />
                    <Row label={t.eventId} value={<span className="select-all font-mono text-[12px]">{event.id}</span>} />
                  </dl>
                </section>

                <section className="rounded-md bg-card p-4">
                  <h3 className="text-[14px] font-semibold text-foreground">{t.matchedTitle}</h3>
                  {event.match_keys.length === 0 && <p className="mt-1 text-[13px] text-foreground/70">{t.matchedNone}</p>}
                  <ul className="mt-2 divide-y divide-border/60">
                    {MATCH_KEYS.map((k) => {
                      const used = event.match_keys.includes(k);
                      return (
                        <li key={k} className="flex items-start gap-3 py-2.5 first:pt-1 last:pb-0">
                          <span className={cn('mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full', used ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' : 'bg-muted text-muted-foreground')}>
                            {used ? <Check className="size-3" strokeWidth={3} /> : <Minus className="size-3" />}
                          </span>
                          <span className="min-w-0">
                            <span className={cn('block text-[13.5px] font-medium', used ? 'text-foreground' : 'text-foreground/50')}>
                              {all.conversions.match[k]}{!used && <span className="font-normal"> · {t.unused}</span>}
                            </span>
                            <span className="block text-[12px] text-muted-foreground">{all.conversions.matchHints[k]}</span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              </div>
            </div>
          );
        })()}
      </SheetContent>
    </Sheet>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-md bg-card px-3.5 py-3">
      <dt className="text-[12px] font-medium text-foreground/60">{label}</dt>
      <dd className="mt-1 truncate text-[15px] font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 px-4 py-2.5">
      <dt className="shrink-0 font-medium text-foreground/60">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}
