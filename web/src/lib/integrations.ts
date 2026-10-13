/**
 * Every platform Seentics has an install guide for. One list feeds the header's
 * Integrations menu and the /integrations page, so a new guide is added once.
 *
 * Icons are the platforms' own marks from the CC0 `simple-icons` set, saved as
 * single-colour SVGs in public/integrations and tinted with `color` at render time
 * (CSS mask), so they stay legible in both themes. Magento has no mark in that set, so it
 * has none here; the UI falls back to a generic cart. The marks are trademarks of their
 * owners and are used only to name the platform.
 */

export type IntegrationCategory = 'Stores & CMS' | 'Frameworks' | 'Website builders' | 'Tag managers' | 'Hosting';

export interface Integration {
  name: string;
  /** File in /integrations/<icon>.svg; absent when the set has no mark. */
  icon?: string;
  /** Brand colour. Near-black marks use `mono` so they follow the theme instead. */
  color: string;
  mono?: boolean;
  /** The mark is a wide wordmark rather than a square glyph (WooCommerce). */
  wide?: boolean;
  description: string;
  /** The guide this opens. */
  href: string;
  category: IntegrationCategory;
  /** Shown in the header menu (the page lists them all). */
  featured?: boolean;
}

export const INTEGRATION_CATEGORIES: IntegrationCategory[] = [
  'Stores & CMS',
  'Frameworks',
  'Website builders',
  'Tag managers',
  'Hosting',
];

export const INTEGRATIONS: Integration[] = [
  { name: 'WordPress', icon: 'wordpress', color: '#21759B', category: 'Stores & CMS', featured: true, href: '/docs/wordpress', description: 'Install the plugin, paste your website ID.' },
  { name: 'WooCommerce', icon: 'woocommerce', color: '#96588A', wide: true, category: 'Stores & CMS', featured: true, href: '/docs/woocommerce', description: 'Purchases, product views and checkout steps.' },
  { name: 'Shopify', icon: 'shopify', color: '#7AB55C', category: 'Stores & CMS', featured: true, href: '/docs/shopify', description: 'Theme snippet and a custom pixel for checkout.' },
  { name: 'BigCommerce', icon: 'bigcommerce', color: '#121118', mono: true, category: 'Stores & CMS', href: '/docs/ecommerce-platforms#bigcommerce', description: 'Script placement and a purchase snippet.' },
  { name: 'PrestaShop', icon: 'prestashop', color: '#DF0067', category: 'Stores & CMS', href: '/docs/ecommerce-platforms#prestashop', description: 'Script placement and a purchase snippet.' },
  { name: 'Magento', color: '#EE672F', category: 'Stores & CMS', href: '/docs/ecommerce-platforms#magento', description: 'Adobe Commerce, through the tag or GTM.' },
  { name: 'Ghost', icon: 'ghost', color: '#15171A', mono: true, category: 'Stores & CMS', href: '/docs/website-builders#ghost', description: 'Code injection for your publication.' },

  { name: 'Next.js', icon: 'nextdotjs', color: '#000000', mono: true, category: 'Frameworks', featured: true, href: '/docs/frameworks#nextjs', description: 'App and pages router, with a server-friendly component.' },
  { name: 'React', icon: 'react', color: '#61DAFB', category: 'Frameworks', featured: true, href: '/docs/frameworks#react', description: 'A component and a hook for Vite and CRA.' },
  { name: 'Vue', icon: 'vuedotjs', color: '#4FC08D', category: 'Frameworks', featured: true, href: '/docs/frameworks#vue', description: 'A plugin, a composable and a v-track directive.' },
  { name: 'Nuxt', icon: 'nuxt', color: '#00DC82', category: 'Frameworks', featured: true, href: '/docs/frameworks#nuxt', description: 'A module that renders the tag on the server.' },
  { name: 'Astro', icon: 'astro', color: '#BC52EE', category: 'Frameworks', featured: true, href: '/docs/frameworks#astro', description: 'A component or an integration, view transitions included.' },
  { name: 'SvelteKit', icon: 'svelte', color: '#FF3E00', category: 'Frameworks', featured: true, href: '/docs/frameworks#svelte', description: 'A component and a use:track action.' },
  { name: 'Remix', icon: 'remix', color: '#000000', mono: true, category: 'Frameworks', href: '/docs/frameworks#other', description: 'One script tag in the root layout.' },
  { name: 'Gatsby', icon: 'gatsby', color: '#663399', category: 'Frameworks', href: '/docs/frameworks#other', description: 'One script tag in your HTML.' },
  { name: 'Angular', icon: 'angular', color: '#0F0F11', mono: true, category: 'Frameworks', href: '/docs/frameworks#other', description: 'One script tag in index.html.' },

  { name: 'Webflow', icon: 'webflow', color: '#146EF5', category: 'Website builders', featured: true, href: '/docs/website-builders#webflow', description: 'Add the tag through custom code.' },
  { name: 'Wix', icon: 'wix', color: '#0C6EFC', category: 'Website builders', href: '/docs/website-builders#wix', description: 'Add the tag through custom code.' },
  { name: 'Squarespace', icon: 'squarespace', color: '#000000', mono: true, category: 'Website builders', href: '/docs/website-builders#squarespace', description: 'Add the tag through code injection.' },
  { name: 'Framer', icon: 'framer', color: '#0055FF', category: 'Website builders', href: '/docs/website-builders#framer', description: 'Add the tag through custom code.' },

  { name: 'Google Tag Manager', icon: 'googletagmanager', color: '#246FDB', category: 'Tag managers', featured: true, href: '/docs/google-tag-manager', description: 'A loader tag and a purchase tag from your dataLayer.' },

  { name: 'Vercel', icon: 'vercel', color: '#000000', mono: true, category: 'Hosting', featured: true, href: '/docs/proxy#vercel', description: 'Serve the tracker from your own domain.' },
  { name: 'Netlify', icon: 'netlify', color: '#00C7B7', category: 'Hosting', href: '/docs/proxy#netlify', description: 'Serve the tracker from your own domain.' },
];
