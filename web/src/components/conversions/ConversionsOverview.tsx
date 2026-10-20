'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
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
  // The counts and the rest (per day, matching, value, kinds) open here on demand: the platforms and
  // the events are what the page is for.
  const [more, setMore] = useState(false);
  const purchases = data?.by_kind.find((k) => k.kind === 'purchase')?.accepted ?? 0;
  // Every platform is told about the same sales, so per currency the most any one was told is the
  // revenue; the currency with the most sales leads.
  const revenue = new Map<string, { value: number; count: number }>();
  for (const v of data?.value ?? []) {
    const r = revenue.get(v.currency);
    if (!r || v.value > r.value) revenue.set(v.currency, { value: v.value, count: Math.max(v.count, r?.count ?? 0) });
  }
  const [currency, top] = [...revenue.entries()].sort((a, b) => b[1].count - a[1].count)[0] ?? [];
  const emailShare = data?.match ? pct(data.match.email, data.match.total) : 0;
  return (
    <section aria-label={t.sent} className="mx-3 mt-3 md:mx-4">
      {/* What the tracking is doing for them, always in view. */}
      <dl className="mb-2 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label={t.purchases} value={data ? purchases : undefined} hint={t.purchasesHint} />
        <div className="min-w-0 rounded-lg bg-card px-4 py-3">
          <dt className="text-[13px] font-medium text-foreground/60">{t.acceptedBy}</dt>
          <dd className="mt-1 text-[22px] font-semibold leading-tight tabular-nums text-emerald-600 dark:text-emerald-400">{totals ? totals.accepted.toLocaleString() : '—'}</dd>
          <p className="mt-0.5 text-[12px] text-muted-foreground">{totals ? t.ofSent(pct(totals.accepted, sent)) : '\u00a0'}</p>
        </div>
        <div className="min-w-0 rounded-lg bg-card px-4 py-3">
          <dt className="text-[13px] font-medium text-foreground/60">{t.revenue}</dt>
          <dd className="mt-1 truncate text-[22px] font-semibold leading-tight tabular-nums text-foreground">{data ? (top ? formatValue(top.value, currency!) : '—') : '—'}</dd>
          <p className="mt-0.5 text-[12px] text-muted-foreground">{top ? t.revenueHint(top.count) : t.valueNone}</p>
        </div>
        <Tile label={t.matchEmail} value={undefined} display={data?.match ? `${emailShare}%` : undefined} hint={t.matchEmailHint} />
      </dl>
      <button
        type="button"
        onClick={() => setMore(!more)}
        aria-expanded={more}
        className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[13px] font-medium text-foreground/70 transition-colors hover:bg-muted/60 hover:text-foreground"
      >
        {more ? t.lessStats : t.moreStats}
        <ChevronDown className={cn('size-4 transition-transform', more && 'rotate-180')} />
      </button>
      {more && (
        <div className="mt-2 space-y-3">
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Tile label={t.sent} value={totals ? sent : undefined} />
            <Tile label={t.failed} value={totals?.failed} tone={totals?.failed ? 'bad' : undefined} />
            <Tile label={t.notSent} value={totals?.skipped} hint={t.notSentHint} />
          </dl>
          <ConversionInsights websiteId={websiteId} days={days} />
        </div>
      )}
    </section>
  );
}

/**
 * Behind the numbers, opened from "View more stats": accepted and failed per day; how well they match a person
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
    <section aria-label={t.perDay} className="space-y-3">

      {/* The days, wide: accepted (green) under failed (red), one bar a day, against a scale. */}
      <Block title={t.perDay} aside={(
        <span className="flex items-center gap-3 text-[12.5px] font-medium">
          <span className="flex items-center gap-1.5 text-foreground"><span className="size-2 rounded-sm bg-emerald-500" />{t.acceptedTotal(data?.totals.accepted ?? 0)}</span>
          <span className="flex items-center gap-1.5 text-foreground"><span className="size-2 rounded-sm bg-rose-500" />{t.failedTotal(data?.totals.failed ?? 0)}</span>
        </span>
      )}>
        <p className="-mt-1 mb-4 text-[12.5px] text-muted-foreground">{t.perDayHint}</p>
        {days_.length === 0 ? <p className="py-8 text-center text-[13px] text-muted-foreground">—</p> : (
          <div className="flex gap-2">
            {/* The scale: the busiest day's count at the top, half way, and 0. */}
            <div className="flex h-40 w-7 shrink-0 flex-col justify-between text-right text-[11px] tabular-nums text-muted-foreground">
              <span className="-mt-1.5">{peak}</span>
              <span>{Math.round(peak / 2)}</span>
              <span className="-mb-1.5">0</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="relative flex h-40 items-end gap-1 border-b border-border" role="img" aria-label={t.perDay}>
                <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-border/70" />
                <span aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-border/50" />
                {days_.map((d) => (
                  <div key={d.day} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end" title={`${shortDay(d.day)}: ${t.acceptedTotal(d.accepted)} · ${t.failedTotal(d.failed)}`}>
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
            </div>
          </div>
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

function Tile({ label, value, display, hint, tone }: { label: string; value: number | undefined; display?: string; hint?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="min-w-0 rounded-lg bg-card px-4 py-3">
      <dt className="text-[13px] font-medium text-foreground/60">{label}</dt>
      <dd className={cn('mt-1 text-[22px] font-semibold leading-tight tabular-nums', tone === 'bad' ? 'text-rose-600 dark:text-rose-400' : tone === 'good' ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground')}>
        {display ?? (value === undefined ? '—' : value.toLocaleString())}
      </dd>
      {hint && <p className="mt-0.5 text-[12px] text-muted-foreground">{hint}</p>}
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
