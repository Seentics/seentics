'use client';

import { useEffect, useState, type ElementType } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight, Blocks, Bot, Code2, Globe, KeyRound, Layers, Rocket, Send, ShieldCheck, ShoppingBag, Tag, Webhook,
} from 'lucide-react';
import { useAPIKeys } from '@/components/developers/api-keys';
import { StatCards } from '@/components/seentics-ui/StatCards';
import { AccountKeysList } from '@/components/developers/AccountKeysPanel';
import { EndpointReference } from '@/components/developers/EndpointReference';
import { WEBSITES_API } from '@/components/developers/websites-api-spec';
import { SnippetCard } from '@/components/developers/SnippetCard';
import { useT, type Messages } from '@/lib/i18n';

type GuideKey = Exclude<keyof Messages['developers']['guides'], 'installAndConfigure' | 'platforms' | 'thisWebsite' | 'docs'>;

/** Account API keys: the Data API and the Management API's websites endpoints take the same key. */
export function DeveloperApiKeysTab({ websiteId, onCreate }: { websiteId: string; onCreate: () => void }) {
  const t = useT().developers.keysTab;
  const { data: keys = [], isLoading } = useAPIKeys(websiteId);
  const canManage = keys.filter(k => k.scopes.includes('websites:write')).length;
  const usedRecently = keys.filter(k => k.lastUsed && Date.now() - new Date(k.lastUsed).getTime() < 7 * 864e5).length;

  return (
    <>
      <StatCards
        isLoading={isLoading}
        cols={3}
        cards={[
          { label: t.apiKeys, value: keys.length },
          { label: t.canManage, value: canManage },
          { label: t.usedThisWeek, value: usedRecently },
        ]}
      />
      <section className="mb-6 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">{t.accountKeys}</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{t.accountKeysHint}</p>
        </div>
        <AccountKeysList websiteId={websiteId} onCreate={onCreate} />
      </section>
    </>
  );
}

/** The Management API, websites only: clients and embeds live in the Agency workspace. */
export function WebsitesApiTab() {
  const t = useT().developers.intro;
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);
  return (
    <EndpointReference
      docs={WEBSITES_API}
      baseUrl={`${origin}/api/v1/manage`}
      intro={<>{t.send} <strong>{t.accountKey}</strong> {t.withScopes} <code className="font-mono text-xs">websites:*</code> {t.scopes} <code className="font-mono text-xs">X-API-Key</code>{t.end}</>}
    />
  );
}

type Guide = { href: string; key: GuideKey; icon: ElementType };

function GuideGrid({ title, guides }: { title: string; guides: Guide[] }) {
  const t = useT().developers.guides;
  return (
    <section className="mb-5">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {guides.map(g => (
          <li key={g.href}>
            <Link
              href={g.href}
              className="group flex h-full items-start gap-3 rounded-lg border border-border bg-card p-3.5 shadow-sm transition-colors hover:border-primary/40 hover:bg-muted/30"
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                <g.icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 text-sm font-semibold text-foreground">
                  {t[g.key].title}
                  <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-60" aria-hidden />
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{t[g.key].description}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

const SETUP_GUIDES: Guide[] = [
  { href: '/docs/quick-start', key: 'quickStart', icon: Rocket },
  { href: '/docs/tracker', key: 'tracker', icon: Code2 },
  { href: '/docs/frameworks', key: 'frameworks', icon: Layers },
  { href: '/docs/google-tag-manager', key: 'gtm', icon: Tag },
  { href: '/docs/proxy', key: 'proxy', icon: ShieldCheck },
];

const PLATFORM_GUIDES: Guide[] = [
  { href: '/docs/wordpress', key: 'wordpress', icon: Globe },
  { href: '/docs/shopify', key: 'shopify', icon: ShoppingBag },
  { href: '/docs/website-builders', key: 'builders', icon: Blocks },
];

/** The site's snippet, then the install guides. */
export function SetupTab({ websiteId }: { websiteId: string }) {
  const t = useT().developers.guides;
  return (
    <>
      <SnippetCard websiteId={websiteId} />
      <GuideGrid title={t.installAndConfigure} guides={SETUP_GUIDES} />
      <GuideGrid title={t.platforms} guides={PLATFORM_GUIDES} />
    </>
  );
}

/** Where this site's data goes out: form integrations and webhooks, ad platforms, automation webhooks. */
export function IntegrationsTab({ websiteId }: { websiteId: string }) {
  const t = useT().developers.guides;
  return (
    <>
      <GuideGrid
        title={t.thisWebsite}
        guides={[
          { href: `/websites/${websiteId}/integrations`, key: 'siteIntegrations', icon: Webhook },
          { href: `/websites/${websiteId}/conversions`, key: 'conversions', icon: Send },
          { href: `/websites/${websiteId}/automations`, key: 'automations', icon: Bot },
        ]}
      />
      <GuideGrid
        title={t.docs}
        guides={[
          { href: '/docs/integrations', key: 'integrationsDoc', icon: Webhook },
          { href: '/docs/api', key: 'dataApiDoc', icon: Code2 },
          { href: '/docs/api-keys', key: 'apiKeysDoc', icon: KeyRound },
        ]}
      />
    </>
  );
}
