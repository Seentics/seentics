'use client';

import { useConversionSummary } from '@/features/conversions/queries';
import { MATCH_KEYS, type EventKind } from '@/features/conversions/types';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { formatValue, PLATFORMS } from './conversion-format';
import { PlatformMark } from './parts';

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
/** "2026-10-04" → "4 Oct". */
const shortDay = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

/**
 * The window's conversions in numbers, for the Conversions page, in two parts: the counts (sent,
 * accepted, failed, not sent) above the events, and what lies behind them below.
 */
export function ConversionStats({ websiteId, days }: { websiteId: string; days: number }) {
  const all = useT();
  const t = all.conversions.overview;
  const { data } = useConversionSummary(websiteId, days);
  const totals = data?.totals;
  // Sent is what went out, whatever came of it: never derived from the total, which counts the
  // ones not sent too (and the demo's did not), so a share of it can never pass 100%.
  const sent = totals ? totals.accepted + totals.failed + totals.pending : 0;
  return (
    <section aria-label={t.sent} className="mx-3 mt-3 md:mx-4">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label={t.sent} value={totals ? sent : undefined} />
        <Tile label={t.accepted} value={totals?.accepted} hint={totals ? t.ofSent(pct(totals.accepted, sent)) : undefined} tone="good" />
        <Tile label={t.failed} value={totals?.failed} tone={totals?.failed ? 'bad' : undefined} />
        <Tile label={t.notSent} value={totals?.skipped} hint={t.notSentHint} />
      </dl>
    </section>
  );
}

/**
 * Behind the numbers, below the events: accepted and failed per day; how well they match a person
 * (the share carrying each detail, with the tip when too few carry an email); the value each
 * platform was told about; and the accepted ones by kind.
 */
export function ConversionInsights({ websiteId, days }: { websiteId: string; days: number }) {
  const all = useT();
  const t = all.conversions.overview;
  const { data } = useConversionSummary(websiteId, days);
  const days_ = data?.by_day ?? [];
  const peak = Math.max(1, ...days_.map((d) => d.accepted + d.failed));
  const match = data?.match;
  return (
    <section aria-label={t.perDay} className="mx-3 mb-4 space-y-3 md:mx-4">

      {/* The days, wide: accepted (green) under failed (red), one bar a day, scaled to the busiest. */}
      <Block title={t.perDay} aside={(
        <span className="flex items-center gap-3 text-[12px] font-normal text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-emerald-500" />{t.accepted}</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-sm bg-rose-500" />{t.failed}</span>
        </span>
      )}>
        {days_.length === 0 ? <p className="py-8 text-center text-[13px] text-muted-foreground">—</p> : (
          <>
            <div className="flex h-40 items-end gap-1" role="img" aria-label={t.perDay}>
              {days_.map((d) => (
                <div key={d.day} className="group flex h-full min-w-0 flex-1 flex-col justify-end" title={`${d.day}: ${d.accepted} ${t.acceptedShort} · ${d.failed} ${t.failed.toLowerCase()}`}>
                  {d.failed > 0 && <div className="w-full rounded-t bg-rose-500/85" style={{ height: `${(d.failed / peak) * 100}%` }} />}
                  <div className={cn('w-full bg-emerald-500/85 group-hover:bg-emerald-600', d.failed === 0 && 'rounded-t')} style={{ height: `${(d.accepted / peak) * 100}%`, minHeight: d.accepted ? 3 : 0 }} />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[11.5px] tabular-nums text-muted-foreground">
              <span>{shortDay(days_[0]!.day)}</span>
              <span>{shortDay(days_[Math.floor(days_.length / 2)]!.day)}</span>
              <span>{shortDay(days_[days_.length - 1]!.day)}</span>
            </div>
          </>
        )}
      </Block>

      <div className="grid gap-3 lg:grid-cols-2">
        <Block title={t.matching}>
          <p className="mb-4 text-[13px] leading-relaxed text-muted-foreground">{t.matchingHint}</p>
          <ul className="space-y-3">
            {MATCH_KEYS.map((k) => {
              const share = match ? pct(match[k], match.total) : 0;
              return (
                <li key={k} className="text-[13.5px]" title={all.conversions.matchHints[k]}>
                  <span className="flex justify-between gap-2">
                    <span className="font-medium text-foreground">{all.conversions.match[k]}</span>
                    <span className="font-semibold tabular-nums text-foreground">{match ? `${share}%` : '—'}</span>
                  </span>
                  <span className="mt-1.5 block h-2 overflow-hidden rounded-full bg-muted">
                    <span className={cn('block h-full rounded-full', share >= 50 ? 'bg-emerald-500' : share >= 20 ? 'bg-amber-500' : 'bg-rose-500')} style={{ width: `${Math.max(2, share)}%` }} />
                  </span>
                  <span className="mt-1 block text-[12px] text-muted-foreground">{all.conversions.matchHints[k]}</span>
                </li>
              );
            })}
          </ul>
          {match && match.total > 0 && match.email / match.total < 0.5 && (
            <p className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900 dark:bg-amber-500/10 dark:text-amber-300">{all.conversions.matchTip}</p>
          )}
        </Block>

        <div className="space-y-3">
          <Block title={t.value}>
            {data && data.value.length > 0 ? (
              <ul className="divide-y divide-border/60">
                {data.value.map((v) => (
                  <li key={`${v.platform}:${v.currency}`} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <PlatformMark platform={v.platform} className="h-9 w-9 rounded-lg" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium text-foreground">{PLATFORMS[v.platform].label}</span>
                      <span className="block text-[12.5px] text-muted-foreground">{v.count.toLocaleString()} {t.acceptedShort}</span>
                    </span>
                    <span className="text-[16px] font-semibold tabular-nums text-foreground">{formatValue(v.value, v.currency)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-[13px] text-muted-foreground">{t.valueNone}</p>}
          </Block>
          <Block title={t.byKind}>
            <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {(data?.by_kind ?? []).map((k) => (
                <div key={k.kind} className="rounded-md bg-muted/50 px-3 py-2.5">
                  <dt className="truncate text-[12.5px] text-muted-foreground">{all.conversions.kinds[k.kind as EventKind]}</dt>
                  <dd className="mt-1 text-[20px] font-semibold leading-none tabular-nums text-foreground">{k.accepted.toLocaleString()}</dd>
                </div>
              ))}
            </dl>
          </Block>
        </div>
      </div>
    </section>
  );
}

function Tile({ label, value, hint, tone }: { label: string; value: number | undefined; hint?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-3 rounded-lg bg-card px-4 py-3">
      <dt className="min-w-0 text-[13px] font-medium text-foreground/60">{label}{hint && <span className="mt-0.5 block text-[12px] font-normal text-muted-foreground">{hint}</span>}</dt>
      <dd className={cn('shrink-0 text-[22px] font-semibold leading-none tabular-nums', tone === 'bad' ? 'text-rose-600 dark:text-rose-400' : tone === 'good' ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground')}>
        {value === undefined ? '—' : value.toLocaleString()}
      </dd>
    </div>
  );
}

function Block({ title, aside, children }: { title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg bg-card px-5 py-4">
      <p className="-mx-5 mb-4 flex items-center justify-between gap-3 border-b border-border/60 px-5 pb-3 text-[13.5px] font-semibold text-foreground">{title}{aside}</p>
      {children}
    </div>
  );
}
