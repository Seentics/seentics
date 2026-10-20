'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { destinationBrand, ProviderIcon, webhookHost } from '@/components/integrations/ProviderIcon';
import { useIntegrations } from '@/features/integrations/queries';
import { describeConnection } from '@/lib/integration-form';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const DOT = { success: 'bg-emerald-500', warning: 'bg-amber-500', danger: 'bg-rose-500', muted: 'bg-muted-foreground/50' } as const;

/**
 * Where a new lead goes, at the top of the Leads page: each connected integration with its logo and
 * how it is doing, and a way to manage them. With none connected, it says leads stay here and
 * offers the tools; with no Slack hook yet, it suggests one for an alert on each new lead.
 */
export function LeadDestinations({ websiteId }: { websiteId: string }) {
  const all = useT();
  const t = all.leads.destinations;
  const statusText = all.settings.integrations.status;
  const { data, isLoading } = useIntegrations(websiteId);
  if (isLoading || !data) return null;
  const connections = data.connections;
  const manage = `/websites/${websiteId}/integrations`;
  const hasSlack = connections.some((c) => c.provider === 'zapier' && webhookHost(c.credentials_hint) === 'hooks.slack.com');

  return (
    <section aria-label={t.title} className="mx-3 mt-4 rounded-lg bg-card px-4 py-3 md:mx-4">
      {connections.length === 0 ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <p className="min-w-0 flex-1 text-[13px] text-foreground/80">{t.none}</p>
          <span className="flex -space-x-1.5">
            <ProviderIcon provider="zapier" hint="hooks.zapier.com" className="size-7 ring-2 ring-card" />
            <ProviderIcon provider="mailchimp" className="size-7 ring-2 ring-card" />
            <ProviderIcon provider="klaviyo" className="size-7 ring-2 ring-card" />
            <ProviderIcon provider="hubspot" className="size-7 ring-2 ring-card" />
            <ProviderIcon provider="zapier" hint="hooks.slack.com" className="size-7 ring-2 ring-card" />
          </span>
          <Link href={manage} className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-[13px] font-medium text-primary-foreground hover:opacity-90">
            {t.connect}<ArrowRight className="size-3.5" />
          </Link>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="text-[12.5px] font-medium text-muted-foreground">{t.title}</span>
          {connections.map((c) => {
            const status = describeConnection(c);
            const brand = destinationBrand(c.provider, c.credentials_hint);
            return (
              <Link
                key={c.id}
                href={manage}
                title={`${c.name} · ${statusText[status.label] ?? status.label}`}
                className={cn('inline-flex items-center gap-2 rounded-full bg-muted/60 py-1 pl-1 pr-3 text-[13px] transition-colors hover:bg-muted', !c.enabled && 'opacity-60')}
              >
                <ProviderIcon provider={c.provider} hint={c.credentials_hint} className="size-6 rounded-full" />
                <span className="font-medium text-foreground">{c.name}</span>
                <span className="sr-only">{brand.label}</span>
                <span className={cn('size-1.5 rounded-full', DOT[status.tone])} aria-hidden />
                {c.pending_count > 0 && <span className="text-[12px] text-muted-foreground">{t.waiting(c.pending_count)}</span>}
              </Link>
            );
          })}
          <Link href={manage} className="ml-auto inline-flex items-center gap-1 text-[13px] font-medium text-foreground/70 hover:text-foreground">
            {t.manage}<ArrowRight className="size-3.5" />
          </Link>
        </div>
      )}
      {!hasSlack && (
        <p className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-border/60 pt-2.5 text-[12.5px] text-muted-foreground">
          <ProviderIcon provider="zapier" hint="hooks.slack.com" className="size-5 rounded" />
          {t.slackTip}
          <Link href={manage} className="font-medium text-foreground underline-offset-2 hover:underline">{t.slackCta}</Link>
        </p>
      )}
    </section>
  );
}
