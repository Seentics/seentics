import {
  BarChart3,
  BookOpen,
  Bot,
  Building2,
  Code2,
  CreditCard,
  Filter,
  Flame,
  KeyRound,
  LayoutDashboard,
  Rocket,
  ShoppingBag,
  ShoppingCart,
  Globe,
  Layers,
  Tags,
  Store,
  LayoutTemplate,
  Route,
  Send,
  Plug,
  ShieldCheck,
  Video,
  Workflow,
  Zap,
} from 'lucide-react';

/**
 * The docs tree — one definition, used by the sidebar, the mobile picker, the
 * previous/next footer and the index cards on `/docs`.
 *
 * It replaces a nav whose every entry was a `#hash` on a single 1,580-line page.
 * Eleven route pages existed alongside that page with overlapping content and no
 * link pointing at them, so the same topic had two URLs and two different texts —
 * and the sidebar always sent you to the anchor, never the route.
 */

export type DocsNavItem = {
  title: string;
  href: string;
  icon: React.ElementType;
  /** One line, used on the `/docs` index cards. */
  summary: string;
};

export type DocsNavGroup = {
  title: string;
  items: DocsNavItem[];
};

export const DOCS_NAV: DocsNavGroup[] = [
  {
    title: 'Getting started',
    items: [
      {
        title: 'Introduction',
        href: '/docs',
        icon: BookOpen,
        summary: 'What Seentics is, and how the pieces fit together.',
      },
      {
        title: 'Quick start',
        href: '/docs/quick-start',
        icon: Rocket,
        summary: 'Add one script tag and see your first visitors.',
      },
    ],
  },
  {
    title: 'Core features',
    items: [
      {
        title: 'Analytics',
        href: '/docs/analytics',
        icon: BarChart3,
        summary: 'Traffic, sources, devices and geography.',
      },
      {
        title: 'Session replays',
        href: '/docs/session-replays',
        icon: Video,
        summary: 'Watch real sessions with console, network and errors.',
      },
      {
        title: 'Heatmaps',
        href: '/docs/heatmaps',
        icon: Flame,
        summary: 'Where visitors click, and how far they scroll.',
      },
      {
        title: 'Funnels',
        href: '/docs/funnels',
        icon: Filter,
        summary: 'Define a path and find the step that loses people.',
      },
      {
        title: 'Automations',
        href: '/docs/automations',
        icon: Workflow,
        summary: 'Triggers, conditions and actions that run in the browser.',
      },
      {
        title: 'Integrations',
        href: '/docs/integrations',
        icon: Plug,
        summary: 'Send form submissions to Zapier, any webhook, Mailchimp, Klaviyo and HubSpot.',
      },
      {
        title: 'Conversions',
        href: '/docs/conversions',
        icon: Send,
        summary: 'Send purchases and leads to Meta, Google, TikTok and LinkedIn from the server.',
      },
    ],
  },
  // Observability's docs (/docs/observability/*) stay reachable by URL, for the links in the
  // product, but are not listed while Observability isn't marketed: not in the nav, the
  // previous / next walk or the sitemap (DOCS_PAGES).
  {
    title: 'Frameworks',
    items: [
      {
        title: 'Frameworks',
        href: '/docs/frameworks',
        icon: Layers,
        summary: 'Next.js, React, Vue, Nuxt, Astro, SvelteKit and plain script setups.',
      },
      {
        title: 'Your own domain',
        href: '/docs/proxy',
        icon: Route,
        summary: 'Serve the tracker from your domain, and what it does to location.',
      },
    ],
  },
  {
    title: 'Integration',
    items: [
      {
        title: 'Tracker script',
        href: '/docs/tracker',
        icon: Zap,
        summary: 'Every script attribute and the browser API.',
      },
      {
        title: 'REST API',
        href: '/docs/api',
        icon: Code2,
        summary: 'Read your data from your own tools.',
      },
      {
        title: 'API keys',
        href: '/docs/api-keys',
        icon: KeyRound,
        summary: 'Create keys, pick scopes, keep them safe.',
      },
      {
        title: 'AI assistants (MCP)',
        href: '/docs/mcp',
        icon: Bot,
        summary: 'Ask Claude, Cursor or VS Code about your websites.',
      },
      {
        title: 'WordPress',
        href: '/docs/wordpress',
        icon: Globe,
        summary: 'Install the plugin and paste your website ID.',
      },
      {
        title: 'WooCommerce',
        href: '/docs/woocommerce',
        icon: ShoppingCart,
        summary: 'Purchases, product views and checkout steps from your store.',
      },
      {
        title: 'Shopify',
        href: '/docs/shopify',
        icon: ShoppingBag,
        summary: 'A theme snippet and a custom pixel for checkout.',
      },
      {
        title: 'Website builders',
        href: '/docs/website-builders',
        icon: LayoutTemplate,
        summary: 'Webflow, Wix, Squarespace, Framer and Ghost.',
      },
      {
        title: 'Google Tag Manager',
        href: '/docs/google-tag-manager',
        icon: Tags,
        summary: 'Load the tracker and send purchases from the dataLayer.',
      },
      {
        title: 'BigCommerce, PrestaShop, Magento',
        href: '/docs/ecommerce-platforms',
        icon: Store,
        summary: 'Script placement and purchase snippets for three store platforms.',
      },
      {
        title: 'UI blocks',
        href: '/docs/ui-blocks',
        icon: LayoutDashboard,
        summary: 'Drop Seentics charts into your own React app.',
      },
    ],
  },
  {
    title: 'Platform',
    items: [
      {
        title: 'Agency',
        href: '/docs/agency',
        icon: Building2,
        summary: 'Manage client sites, users and white labelling.',
      },
      {
        title: 'Billing & plans',
        href: '/docs/billing',
        icon: CreditCard,
        summary: 'Limits, upgrades and what counts as an event.',
      },
      {
        title: 'Privacy & security',
        href: '/docs/privacy',
        icon: ShieldCheck,
        summary: 'What is stored, what is not, and how to control it.',
      },
    ],
  },
];

/** Flat, in reading order — what previous/next walks. */
export const DOCS_PAGES: DocsNavItem[] = DOCS_NAV.flatMap((g) => g.items);

export function docsNeighbours(pathname: string): {
  prev: DocsNavItem | null;
  next: DocsNavItem | null;
} {
  const i = DOCS_PAGES.findIndex((p) => p.href === pathname);
  if (i === -1) return { prev: null, next: null };
  return {
    prev: i > 0 ? DOCS_PAGES[i - 1]! : null,
    next: i < DOCS_PAGES.length - 1 ? DOCS_PAGES[i + 1]! : null,
  };
}
