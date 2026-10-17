/** The agency API on the wire: snake_case, ISO timestamps. */

import { trackingSnippet, type Client, type ClientWithWebsites, type Website } from "../../websites/interfaces";
import type {
  AgencyAlert,
  AgencyOverview,
  BrandView,
  MetricTotals,
  Verification,
  WhiteLabelSettings,
} from "../interfaces";

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export function presentWhiteLabel(s: WhiteLabelSettings) {
  return {
    brand_name: s.brandName,
    logo_url: s.logoUrl,
    primary_color: s.primaryColor,
    support_email: s.supportEmail,
    footer_text: s.footerText,
    hide_seentics: s.hideSeentics,
    slug: s.slug,
    updated_at: iso(s.updatedAt),
  };
}

/** What a client may see of the agency's settings: no slug, no owner. */
export function presentBrand(s: WhiteLabelSettings): BrandView {
  return {
    brand_name: s.brandName,
    logo_url: s.logoUrl,
    primary_color: s.primaryColor,
    support_email: s.supportEmail,
    footer_text: s.footerText,
    hide_seentics: s.hideSeentics,
  };
}

export function presentWebsite(site: Website) {
  return {
    id: site.id,
    client_id: site.clientId,
    name: site.name,
    url: site.url,
    tracking_id: site.trackingId,
    is_active: site.isActive,
    is_verified: site.isVerified,
    created_at: site.createdAt.toISOString(),
    updated_at: site.updatedAt.toISOString(),
  };
}

/** A list row: the count of sites, not the sites. */
export function presentClient(client: Client & { websites?: Website[] }) {
  return {
    id: client.id,
    name: client.name,
    company: client.company,
    notes: client.notes,
    status: client.status,
    website_count: client.websites?.length ?? 0,
    collect_features: client.collectFeatures,
    created_at: client.createdAt.toISOString(),
    updated_at: client.updatedAt.toISOString(),
  };
}

/** The detail view: the client and its sites. */
export function presentClientDetail(client: ClientWithWebsites) {
  return { ...presentClient(client), websites: client.websites.map(presentWebsite) };
}

export function presentVerification(v: Verification) {
  return {
    status: v.status,
    is_verified: v.isVerified,
    last_event_at: iso(v.lastEventAt),
    events_24h: v.events24h,
  };
}

/**
 * How to install the tracker on each kind of site: one line each, and the docs page that has
 * the rest. The web app renders these; the docs links are absolute so an API caller can too.
 */
function instructions(snippet: string, websiteId: string, docs: (path: string) => string) {
  return {
    html: {
      summary: `Paste this tag into the <head> of every page: ${snippet}`,
      docs_url: docs("/docs/tracker"),
    },
    gtm: {
      summary: "In Google Tag Manager, add a Custom HTML tag with the snippet, fired on All Pages, then publish the container.",
      docs_url: docs("/docs/google-tag-manager"),
    },
    nextjs: {
      summary: `npm i @seentics/next, then render <Seentics websiteId="${websiteId}" /> in the root layout (app/layout.tsx or pages/_app.tsx).`,
      docs_url: docs("/docs/frameworks#nextjs"),
    },
    wordpress: {
      summary: `Install the Seentics plugin and paste the website ID ${websiteId} into its settings; no code to edit.`,
      docs_url: docs("/docs/wordpress"),
    },
    shopify: {
      summary: "Paste the snippet into theme.liquid before </head> for the storefront, and add the Seentics custom pixel for purchases.",
      docs_url: docs("/docs/shopify"),
    },
    npm: {
      summary: `npm i @seentics/react (or vue, nuxt, astro, svelte) and pass websiteId "${websiteId}" to its component.`,
      docs_url: docs("/docs/frameworks"),
    },
  };
}

export function presentInstall(site: Website, verification: Verification, urls: { scriptUrl: string; frontendUrl: string }) {
  const snippet = trackingSnippet(urls.scriptUrl, site.id);
  const docs = (path: string) => `${urls.frontendUrl}${path}`;
  return {
    website_id: site.id,
    tracking_id: site.trackingId,
    script_url: urls.scriptUrl,
    snippet_html: snippet,
    instructions: instructions(snippet, site.id, docs),
    verification: presentVerification(verification),
  };
}

export function presentAlert(a: AgencyAlert) {
  return {
    id: a.id,
    kind: a.kind,
    client_id: a.clientId,
    website_id: a.websiteId,
    resource: a.resource,
    period: a.period,
    created_at: a.createdAt.toISOString(),
    dismissed_at: iso(a.dismissedAt),
  };
}

/** Rounded once here so every row and the totals agree on two decimals for money. */
const totals = (t: MetricTotals) => ({ ...t, ...(t.revenue !== undefined ? { revenue: Math.round(t.revenue * 100) / 100 } : {}) });

export function presentOverview(o: AgencyOverview) {
  return {
    period: {
      key: o.period,
      start: o.window.from,
      end: o.window.to,
      previous_start: o.previousWindow.from,
      previous_end: o.previousWindow.to,
    },
    totals: totals(o.totals),
    previous_totals: totals(o.previous),
    clients: o.clients.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      website_count: c.websiteCount,
      totals: totals(c.totals),
      previous_totals: totals(c.previous),
    })),
    top_movers: o.movers.map((m) => ({
      website_id: m.websiteId,
      website_name: m.websiteName,
      client_id: m.clientId,
      metric: m.metric,
      current: m.current,
      previous: m.previous,
      change_pct: m.changePct,
    })),
    alerts: o.alerts.map(presentAlert),
    generated_at: o.generatedAt.toISOString(),
  };
}
