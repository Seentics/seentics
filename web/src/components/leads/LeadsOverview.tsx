'use client';

import { useLeadsOverview } from '@/features/leads/queries';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

/**
 * The last 30 days in numbers, at the top of the Leads page: how many leads came in, how many new
 * people, how many of them became customers, how many failed to reach an integration (with a way
 * to see and retry them), and where the leads came from — the channels and the campaigns that brought most.
 */
export function LeadsOverview({ websiteId, onShowFailed }: { websiteId: string; onShowFailed: () => void }) {
  const all = useT();
  const t = all.leads.overview;
  const { data } = useLeadsOverview(websiteId, 30);
  const pct = data && data.new_contacts > 0 ? Math.round((data.customers / data.new_contacts) * 100) : 0;
  const total = data?.by_channel.reduce((n, c) => n + c.count, 0) ?? 0;

  return (
    // Two rows with room to breathe: the four numbers across the width, then the channels and the
    // campaigns side by side, each its own block.
    <section aria-label={t.label} className="mx-3 mt-1 space-y-3 md:mx-4">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label={t.leads} value={data?.submissions} />
        <Tile label={t.newContacts} value={data?.new_contacts} />
        <Tile label={t.customers} value={data?.customers} hint={data ? t.ofNew(pct) : undefined} />
        <div className="min-w-0 rounded-lg bg-card px-5 py-4">
          <dt className="text-[13px] font-medium text-foreground/60">{t.failed}</dt>
          <dd className={cn('mt-1.5 text-[26px] font-semibold leading-none tabular-nums', data?.failed_deliveries ? 'text-rose-600 dark:text-rose-400' : 'text-foreground')}>
            {data ? data.failed_deliveries.toLocaleString() : '—'}
          </dd>
          {!!data?.failed_deliveries && (
            <button type="button" onClick={onShowFailed} className="mt-2 text-[12.5px] font-medium text-foreground/70 underline underline-offset-2 hover:text-foreground">{t.fix}</button>
          )}
        </div>
      </dl>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="min-w-0 rounded-lg bg-card px-5 py-4">
          <p className="text-[13px] font-semibold text-foreground">{t.channels}</p>
          {data && total > 0 ? (
            <ul className="mt-3 space-y-2.5">
              {data.by_channel.slice(0, 5).map((c) => (
                <li key={c.channel} className="text-[13.5px]">
                  <span className="flex justify-between gap-2"><span className="truncate text-foreground">{all.leads.channels[c.channel]}</span><span className="tabular-nums text-muted-foreground">{c.count.toLocaleString()}</span></span>
                  <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary/70" style={{ width: `${Math.max(4, (c.count / total) * 100)}%` }} /></span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-[13px] text-muted-foreground">{t.none}</p>}
        </div>
        <div className="min-w-0 rounded-lg bg-card px-5 py-4">
          <p className="text-[13px] font-semibold text-foreground">{t.campaigns}</p>
          {data && data.by_campaign.length > 0 ? (
            <ul className="mt-3 divide-y divide-border/60 text-[13.5px]">
              {data.by_campaign.map((c) => (
                <li key={c.campaign} className="flex justify-between gap-2 py-2 first:pt-0 last:pb-0">
                  <span className="truncate font-mono text-[12.5px] text-foreground" title={c.campaign}>{c.campaign}</span>
                  <span className="tabular-nums text-muted-foreground">{c.count.toLocaleString()}</span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-[13px] text-muted-foreground">—</p>}
        </div>
      </div>
    </section>
  );
}

function Tile({ label, value, hint }: { label: string; value: number | undefined; hint?: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-card px-5 py-4">
      <dt className="text-[13px] font-medium text-foreground/60">{label}</dt>
      <dd className="mt-1.5 text-[26px] font-semibold leading-none tabular-nums text-foreground">{value === undefined ? '—' : value.toLocaleString()}</dd>
      {hint && <p className="mt-2 text-[12.5px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
