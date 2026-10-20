'use client';

import { Mail, MessageSquare, QrCode } from 'lucide-react';
import { getSourceImage } from '@/components/analytics/TopSourcesChart';
import { ProviderIcon } from '@/components/integrations/ProviderIcon';
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
  const sourceTotal = data?.by_source.reduce((n, s) => n + s.count, 0) ?? 0;

  return (
    // Two rows with room to breathe: the four numbers across the width, then the channels and the
    // campaigns side by side, each its own block.
    <section aria-label={t.label} className="mx-3 mt-5 space-y-3 md:mx-4 md:mt-6">
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
          <p className="-mx-5 border-b border-border/60 px-5 pb-3 text-[13px] font-semibold text-foreground">{t.channels}</p>
          {data && data.by_source.length > 0 ? (
            // The sites themselves (Facebook, Google…), each with its logo; channels when none is known.
            <ul className="mt-3.5 space-y-2.5">
              {data.by_source.slice(0, 5).map((s) => (
                <li key={s.source} className="flex items-center gap-3 text-[13.5px]">
                  <SourceLogo source={s.source} />
                  <span className="min-w-0 flex-1">
                    <span className="flex justify-between gap-2"><span className="truncate font-medium text-foreground">{sourceName(s.source)}</span><span className="tabular-nums text-muted-foreground">{s.count.toLocaleString()}</span></span>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary/70" style={{ width: `${Math.max(4, (s.count / sourceTotal) * 100)}%` }} /></span>
                  </span>
                </li>
              ))}
            </ul>
          ) : data && total > 0 ? (
            <ul className="mt-3.5 space-y-2.5">
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
          <p className="-mx-5 border-b border-border/60 px-5 pb-3 text-[13px] font-semibold text-foreground">{t.campaigns}</p>
          {data && data.by_campaign.length > 0 ? (
            <ul className="mt-3.5 divide-y divide-border/60 text-[13.5px]">
              {data.by_campaign.map((c) => (
                <li key={c.campaign} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                  {c.source ? <SourceLogo source={c.source} /> : <span aria-hidden className="size-6 shrink-0 rounded-md bg-muted" />}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-[12.5px] text-foreground" title={c.campaign}>{c.campaign}</span>
                    {c.source && <span className="block truncate text-[12px] text-muted-foreground">{sourceName(c.source)}</span>}
                  </span>
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

/** The names Core gives the big sources (lib/source.ts), as people write them. */
const SOURCE_NAMES: Record<string, string> = {
  facebook: 'Facebook', instagram: 'Instagram', google: 'Google', youtube: 'YouTube', tiktok: 'TikTok',
  x: 'X', linkedin: 'LinkedIn', whatsapp: 'WhatsApp', messenger: 'Messenger', bing: 'Bing',
  mailchimp: 'Mailchimp', klaviyo: 'Klaviyo', hubspot: 'HubSpot',
};
/** A known name as written, a site as its host, any other name with a capital (newsletter → Newsletter). */
const sourceName = (source: string) =>
  SOURCE_NAMES[source] ?? (source.includes('.') ? source : source.charAt(0).toUpperCase() + source.slice(1));

/** Kinds of source that are not a site (utm_source=newsletter, sms…): an icon on their colour. */
const KINDS: [RegExp, React.ElementType, string][] = [
  [/mail|newsletter|digest|edm/, Mail, '#F59E0B'],
  [/^sms$|text|message/, MessageSquare, '#16A34A'],
  [/qr/, QrCode, '#18181B'],
];

/** A steady colour per name, so an unknown source looks the same everywhere it appears. */
function hueOf(name: string): number {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

/**
 * A source's own logo: the analytics pages' images (getSourceImage), Messenger's mark, the email
 * tools' logos (Mailchimp, Klaviyo, HubSpot), an icon for a kind of source (newsletter, sms, qr),
 * or for any other name its initial on a colour of its own.
 */
function SourceLogo({ source }: { source: string }) {
  if (source === 'mailchimp' || source === 'klaviyo' || source === 'hubspot') return <ProviderIcon provider={source} className="size-6 rounded-md" />;
  const kind = KINDS.find(([pattern]) => pattern.test(source));
  if (kind) {
    const [, Icon, color] = kind;
    return <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-md text-white" style={{ background: color }}><Icon className="size-3.5" /></span>;
  }
  if (source === 'messenger') {
    const mask = 'url(/integrations/messenger.svg) center / 62% no-repeat';
    return <span aria-hidden className="size-6 shrink-0 rounded-md bg-[#0866FF]"><span className="block h-full w-full bg-white" style={{ WebkitMask: mask, mask }} /></span>;
  }
  const image = getSourceImage(source === 'x' ? 'x.com' : source);
  if (image) return <img src={image} alt="" aria-hidden className="size-6 shrink-0 rounded-md object-contain" />;
  return (
    <span aria-hidden className="flex size-6 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold uppercase text-white" style={{ background: `hsl(${hueOf(source)} 55% 45%)` }}>
      {source.replace(/^www\./, '')[0]}
    </span>
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
