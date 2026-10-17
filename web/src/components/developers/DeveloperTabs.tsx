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

/** Account API keys: the Data API and the Management API's websites endpoints take the same key. */
export function DeveloperApiKeysTab({ websiteId, onCreate }: { websiteId: string; onCreate: () => void }) {
  const { data: keys = [], isLoading } = useAPIKeys(websiteId);
  const canManage = keys.filter(k => k.scopes.includes('websites:write')).length;
  const usedRecently = keys.filter(k => k.lastUsed && Date.now() - new Date(k.lastUsed).getTime() < 7 * 864e5).length;

  return (
    <>
      <StatCards
        isLoading={isLoading}
        cols={3}
        cards={[
          { label: 'API keys', value: keys.length },
          { label: 'Can manage', value: canManage },
          { label: 'Used this week', value: usedRecently },
        ]}
      />
      <section className="mb-6 overflow-hidden rounded-lg border border-border bg-card shadow-sm">
        <div className="border-b border-border px-4 py-3">
          <h3 className="text-sm font-semibold text-foreground">Account keys</h3>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Send one as X-API-Key to read analytics and manage websites from your own server. Keep it out of the browser.
          </p>
        </div>
        <AccountKeysList websiteId={websiteId} onCreate={onCreate} />
      </section>
    </>
  );
}

/** The Management API, websites only: clients and embeds live in the Agency workspace. */
export function WebsitesApiTab() {
  const [origin, setOrigin] = useState('');
  useEffect(() => setOrigin(window.location.origin), []);
  return (
    <EndpointReference
      docs={WEBSITES_API}
      baseUrl={`${origin}/api/v1/manage`}
      intro={<>Send an <strong>account key</strong> with the <code className="font-mono text-xs">websites:*</code> scopes as <code className="font-mono text-xs">X-API-Key</code>.</>}
    />
  );
}

type Guide = { href: string; title: string; description: string; icon: ElementType };

function GuideGrid({ title, guides }: { title: string; guides: Guide[] }) {
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
                  {g.title}
                  <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-60" aria-hidden />
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{g.description}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

const SETUP_GUIDES: Guide[] = [
  { href: '/docs/quick-start', title: 'Quick start', description: 'One script tag, then your first visitors.', icon: Rocket },
  { href: '/docs/tracker', title: 'Tracker reference', description: 'Script attributes and the browser API: track, identify, page and flush.', icon: Code2 },
  { href: '/docs/frameworks', title: 'Frameworks', description: 'Next.js, React, Vue, Nuxt, Astro, SvelteKit, Remix, Gatsby and Angular.', icon: Layers },
  { href: '/docs/google-tag-manager', title: 'Google Tag Manager', description: 'Load Seentics from GTM and send GA4 ecommerce purchases.', icon: Tag },
  { href: '/docs/proxy', title: 'Serve from your domain', description: 'Proxy the tracker on Next.js, Vercel, Netlify, Cloudflare or nginx.', icon: ShieldCheck },
];

const PLATFORM_GUIDES: Guide[] = [
  { href: '/docs/wordpress', title: 'WordPress', description: 'Install the plugin and paste your website ID.', icon: Globe },
  { href: '/docs/shopify', title: 'Shopify', description: 'A theme snippet for the storefront, a custom pixel for checkout.', icon: ShoppingBag },
  { href: '/docs/website-builders', title: 'Website builders', description: 'Webflow, Wix, Squarespace, Framer and Ghost.', icon: Blocks },
];

/** The site's snippet, then the install guides. */
export function SetupTab({ websiteId }: { websiteId: string }) {
  return (
    <>
      <SnippetCard websiteId={websiteId} />
      <GuideGrid title="Install and configure" guides={SETUP_GUIDES} />
      <GuideGrid title="Platforms" guides={PLATFORM_GUIDES} />
    </>
  );
}

/** Where this site's data goes out: form integrations and webhooks, ad platforms, automation webhooks. */
export function IntegrationsTab({ websiteId }: { websiteId: string }) {
  return (
    <>
      <GuideGrid
        title="This website"
        guides={[
          { href: `/websites/${websiteId}/settings/integrations`, title: 'Integrations & webhooks', description: 'Send form submissions to any webhook, Zapier, Mailchimp, Klaviyo or HubSpot.', icon: Webhook },
          { href: `/websites/${websiteId}/conversions`, title: 'Conversions', description: 'Send sales and leads to ad platforms from Seentics’ servers.', icon: Send },
          { href: `/websites/${websiteId}/automations`, title: 'Automations', description: 'Call a webhook when a visitor does something.', icon: Bot },
        ]}
      />
      <GuideGrid
        title="Docs"
        guides={[
          { href: '/docs/integrations', title: 'Integrations', description: 'How deliveries, retries and credentials work.', icon: Webhook },
          { href: '/docs/api', title: 'Data API', description: 'Base URL, authentication and the live endpoint catalogue.', icon: Code2 },
          { href: '/docs/api-keys', title: 'API keys', description: 'Create a key, choose its scopes, and use it safely.', icon: KeyRound },
        ]}
      />
    </>
  );
}
