'use client';

import { useState } from 'react';
import { ArrowDownRight, ArrowUpRight, ChevronDown, Mail, MessageSquare, QrCode } from 'lucide-react';
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
  // Where they came from and the campaigns open on demand, so the people and submissions stay near the top.
  const [more, setMore] = useState(false);

  return (
    // Two rows with room to breathe: the four numbers across the width, then the channels and the
    // campaigns side by side, each its own block.
    <section aria-label={t.label} className="mx-3 mt-5 md:mx-4 md:mt-6">
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label={t.leads} value={data?.submissions} previous={data?.previous?.submissions} />
        <Tile label={t.newContacts} value={data?.new_contacts} previous={data?.previous?.new_contacts} />
        <Tile label={t.customers} value={data?.customers} previous={data?.previous?.customers} hint={data ? t.ofNew(pct) : undefined} />
        <div className="min-w-0 rounded-lg bg-card px-4 py-3">
          <dt className="text-[13px] font-medium text-foreground/60">{t.failed}</dt>
          <dd className={cn('mt-1 text-[22px] font-semibold leading-tight tabular-nums', data?.failed_deliveries ? 'text-rose-600 dark:text-rose-400' : 'text-foreground')}>
            {data ? data.failed_deliveries.toLocaleString() : '—'}
          </dd>
          {!!data?.failed_deliveries && (
            <button type="button" onClick={onShowFailed} className="mt-0.5 text-[12px] font-medium text-foreground/70 underline underline-offset-2 hover:text-foreground">{t.fix}</button>
          )}
        </div>
      </dl>

      {/* Every lead's source in one bar: each source's share, then a legend with its logo and count. */}
      <SourceShare data={data} />

      <button
        type="button"
        onClick={() => setMore(!more)}
        aria-expanded={more}
        className="mt-2 inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[13px] font-medium text-foreground/70 transition-colors hover:bg-muted/60 hover:text-foreground"
      >
        {more ? t.lessStats : t.moreStats}
        <ChevronDown className={cn('size-4 transition-transform', more && 'rotate-180')} />
      </button>
      {more && <div className="mt-2">
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
      </div>}
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

/** Each source's colour: its brand's for the big ones, calm greys for the rest, a pale one for direct. */
const BRAND_COLOR: Record<string, string> = {
  facebook: '#1877F2', instagram: '#E1306C', google: '#EA4335', youtube: '#FF0000', tiktok: '#111111',
  x: '#000000', linkedin: '#0A66C2', whatsapp: '#25D366', messenger: '#0866FF', bing: '#00809D',
  mailchimp: '#FFE01B', klaviyo: '#232426', hubspot: '#FF7A59',
};
const SPARE = ['#3346C9', '#E07B24', '#8A93B8', '#5B8DEF', '#B4729A', '#6BA292'];
const DIRECT = '#C9CEDD';
/** A brand colour, softened toward the page so the bar reads calm in either theme. */
const soft = (color: string) => `color-mix(in srgb, ${color} 60%, hsl(var(--card)))`;

function SourceShare({ data }: { data: ReturnType<typeof useLeadsOverview>['data'] }) {
  const t = useT().leads.overview;
  if (!data || data.submissions === 0) return null;
  let spare = 0;
  const parts = data.by_source.map((s) => ({ key: s.source, label: sourceName(s.source), count: s.count, color: BRAND_COLOR[s.source] ?? SPARE[spare++ % SPARE.length]! }));
  // Leads with no known source (typed in, a bookmark) or beyond the top six.
  const rest = data.submissions - parts.reduce((n, p) => n + p.count, 0);
  if (rest > 0) parts.push({ key: '__direct', label: t.directOther, count: rest, color: DIRECT });
  const share = (n: number) => (n / data.submissions) * 100;
  return (
    <section aria-labelledby="lead-sources" className="mt-3 flex flex-col gap-2.5 rounded-lg bg-card px-4 py-3">
      <h2 id="lead-sources" className="text-[13px] font-medium text-foreground/60">{t.channels}</h2>
      <div className="flex h-2 gap-px overflow-hidden rounded-full" role="img" aria-label={parts.map((p) => `${p.label} ${Math.round(share(p.count))}%`).join(', ')}>
        {parts.map((p) => <div key={p.key} style={{ width: `${share(p.count)}%`, background: soft(p.color) }} title={`${p.label}: ${p.count.toLocaleString()} (${Math.round(share(p.count))}%)`} />)}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[13px]">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-2">
            <span aria-hidden className="size-2 rounded-[2px]" style={{ background: soft(p.color) }} />
            {p.key !== '__direct' && <span className="[&>*]:size-4 [&>*]:rounded"><SourceLogo source={p.key} /></span>}
            <span className="text-foreground">{p.label}</span>
            <span className="font-semibold tabular-nums text-foreground">{p.count.toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Tile({ label, value, previous, hint }: { label: string; value: number | undefined; previous?: number; hint?: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-card px-4 py-3">
      <dt className="text-[13px] font-medium text-foreground/60">{label}</dt>
      <dd className="mt-1 text-[22px] font-semibold leading-tight tabular-nums text-foreground">{value === undefined ? '—' : value.toLocaleString()}</dd>
      {value !== undefined && previous !== undefined && <Change value={value} previous={previous} />}
      {hint && <p className="mt-0.5 text-[12px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Up or down against the 30 days before, as a share: green up, red down, grey when level; "New"
 * when there was nothing before to compare with.
 */
function Change({ value, previous }: { value: number; previous: number }) {
  const t = useT().leads.overview;
  if (previous === 0 && value === 0) return null;
  const title = t.vsPrevious(previous.toLocaleString());
  const change = previous === 0 ? null : Math.round(((value - previous) / previous) * 100);
  const Icon = change !== null && change < 0 ? ArrowDownRight : ArrowUpRight;
  const tone = change === null || change > 0 ? 'text-emerald-700 dark:text-emerald-400' : change < 0 ? 'text-rose-700 dark:text-rose-400' : 'text-muted-foreground';
  return (
    <p title={title} className="mt-1 flex items-center gap-1 text-[12px]">
      <span className={cn('inline-flex items-center gap-0.5 font-semibold tabular-nums', tone)}>
        {change !== 0 && <Icon className="size-3.5" aria-hidden />}
        {change === null ? t.newChange : `${Math.abs(change)}%`}
      </span>
      <span className="text-muted-foreground">{t.vsLast}</span>
    </p>
  );
}
