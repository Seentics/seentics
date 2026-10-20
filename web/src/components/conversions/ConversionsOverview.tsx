'use client';

import { useConversionSummary } from '@/features/conversions/queries';
import { MATCH_KEYS, type EventKind } from '@/features/conversions/types';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { formatValue, PLATFORMS } from './conversion-format';
import { PlatformMark } from './parts';

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/**
 * The window's conversions in numbers, at the top of the Conversions page: how many were sent,
 * accepted, failed and not sent; accepted and failed per day; how well they match a person (the
 * share carrying each detail, with the tip when too few carry an email); the value each platform
 * was told about; and the accepted ones by kind.
 */
export function ConversionsOverview({ websiteId, days }: { websiteId: string; days: number }) {
  const all = useT();
  const t = all.conversions.overview;
  const { data } = useConversionSummary(websiteId, days);
  const totals = data?.totals;
  const sent = totals ? totals.sent - totals.skipped : 0;
  const peak = Math.max(1, ...(data?.by_day ?? []).map((d) => d.accepted + d.failed));
  const match = data?.match;

  return (
    <section aria-label={t.sent} className="mx-3 mt-4 space-y-3 md:mx-4">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label={t.sent} value={totals ? sent : undefined} />
        <Tile label={t.accepted} value={totals?.accepted} hint={totals ? t.ofSent(pct(totals.accepted, sent)) : undefined} tone="good" />
        <Tile label={t.failed} value={totals?.failed} tone={totals?.failed ? 'bad' : undefined} />
        <Tile label={t.notSent} value={totals?.skipped} hint={t.notSentHint} />
      </dl>

      <div className="grid gap-3 lg:grid-cols-3">
        <Block title={t.perDay}>
          {/* Accepted (green) under failed (red), one bar a day, scaled to the busiest day. */}
          <div className="flex h-32 items-end gap-[3px]" role="img" aria-label={t.perDay}>
            {(data?.by_day ?? []).map((d) => (
              <span key={d.day} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${d.day}: ${d.accepted} ${t.acceptedShort} · ${d.failed} ${t.failed.toLowerCase()}`}>
                {d.failed > 0 && <span className="w-full rounded-t-sm bg-rose-500/80" style={{ height: `${(d.failed / peak) * 100}%` }} />}
                <span className={cn('w-full bg-emerald-500/80', d.failed === 0 && 'rounded-t-sm')} style={{ height: `${(d.accepted / peak) * 100}%`, minHeight: d.accepted ? 2 : 0 }} />
              </span>
            ))}
          </div>
        </Block>

        <Block title={t.matching}>
          <p className="-mt-1 mb-3 text-[12px] text-muted-foreground">{t.matchingHint}</p>
          <ul className="space-y-2">
            {MATCH_KEYS.map((k) => {
              const share = match ? pct(match[k], match.total) : 0;
              return (
                <li key={k} className="text-[13px]" title={all.conversions.matchHints[k]}>
                  <span className="flex justify-between gap-2"><span className="text-foreground">{all.conversions.match[k]}</span><span className="tabular-nums text-muted-foreground">{match ? `${share}%` : '—'}</span></span>
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted">
                    <span className={cn('block h-full rounded-full', share >= 50 ? 'bg-emerald-500/80' : share >= 20 ? 'bg-amber-500/80' : 'bg-rose-500/70')} style={{ width: `${Math.max(2, share)}%` }} />
                  </span>
                </li>
              );
            })}
          </ul>
          {match && match.total > 0 && match.email / match.total < 0.5 && (
            <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900 dark:bg-amber-500/10 dark:text-amber-300">{all.conversions.matchTip}</p>
          )}
        </Block>

        <Block title={t.value}>
          {data && data.value.length > 0 ? (
            <ul className="divide-y divide-border/60">
              {data.value.map((v) => (
                <li key={`${v.platform}:${v.currency}`} className="flex items-center gap-3 py-2 first:pt-0">
                  <PlatformMark platform={v.platform} className="h-7 w-7 rounded-md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-foreground">{PLATFORMS[v.platform].label}</span>
                    <span className="block text-[12px] text-muted-foreground">{v.count.toLocaleString()} {t.acceptedShort}</span>
                  </span>
                  <span className="text-[14px] font-semibold tabular-nums text-foreground">{formatValue(v.value, v.currency)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-[13px] text-muted-foreground">{t.valueNone}</p>}
          {data && (
            <>
              <p className="mb-2 mt-4 border-t border-border/60 pt-3 text-[12px] font-medium text-foreground/60">{t.byKind}</p>
              <ul className="grid grid-cols-2 gap-2">
                {data.by_kind.filter((k) => k.accepted > 0).map((k) => (
                  <li key={k.kind} className="flex justify-between rounded-md bg-muted/50 px-2.5 py-1.5 text-[13px]">
                    <span className="text-foreground">{all.conversions.kinds[k.kind as EventKind]}</span>
                    <span className="font-semibold tabular-nums text-foreground">{k.accepted.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Block>
      </div>
    </section>
  );
}

function Tile({ label, value, hint, tone }: { label: string; value: number | undefined; hint?: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="min-w-0 rounded-lg bg-card px-5 py-4">
      <dt className="text-[13px] font-medium text-foreground/60">{label}</dt>
      <dd className={cn('mt-1.5 text-[26px] font-semibold leading-none tabular-nums', tone === 'bad' ? 'text-rose-600 dark:text-rose-400' : tone === 'good' ? 'text-emerald-700 dark:text-emerald-400' : 'text-foreground')}>
        {value === undefined ? '—' : value.toLocaleString()}
      </dd>
      {hint && <p className="mt-2 text-[12.5px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-lg bg-card px-5 py-4">
      <p className="-mx-5 mb-3 border-b border-border/60 px-5 pb-3 text-[13px] font-semibold text-foreground">{title}</p>
      {children}
    </div>
  );
}
