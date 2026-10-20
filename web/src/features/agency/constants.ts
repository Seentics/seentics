import type { EmbedSection, FeatureAccess, FeatureId, InstallMethod, Resource, SetupStepId } from './types';

/**
 * The dashboard pages a client can be shown, in sidebar order. Their names and descriptions are
 * words: `useT().agency.features.items[id]`.
 */
export const FEATURE_IDS: FeatureId[] = [
  'overview', 'events', 'paths', 'revenue', 'recordings', 'heatmaps', 'funnels', 'goals',
  'automations', 'leads', 'conversions', 'ai', 'errors', 'privacy',
];

/** Off, view, edit: `useT().agency.features.access[id]`. */
export const FEATURE_ACCESS_IDS: FeatureAccess[] = ['off', 'view', 'edit'];

/** The capped resources, in display order: `useT().agency.usage.resources[id]`. */
export const RESOURCE_IDS: Resource[] = ['events', 'recordings', 'leads', 'ai_analyses'];

/** Platform and product names, the same in every language. */
export const INSTALL_METHODS: Array<{ id: InstallMethod; label: string }> = [
  { id: 'html', label: 'HTML' },
  { id: 'gtm', label: 'Google Tag Manager' },
  { id: 'nextjs', label: 'Next.js' },
  { id: 'wordpress', label: 'WordPress' },
  { id: 'shopify', label: 'Shopify' },
  { id: 'npm', label: 'npm' },
];

/** What an embed link can show, in order: `useT().agency.embeds.sections[id]`. */
export const EMBED_SECTION_IDS: EmbedSection[] = ['analytics', 'recordings', 'heatmaps'];

/** The setup guide, in order: where each step is done. Its words: `useT().agency.setup.steps[id]`. */
export const SETUP_STEPS: Array<{ id: SetupStepId; href: string }> = [
  { id: 'branding', href: '/agency/branding' },
  { id: 'first_client', href: '/agency/clients?new=1' },
  { id: 'website_installed', href: '/agency/websites' },
  { id: 'client_user', href: '/agency/clients' },
  { id: 'features_limits', href: '/agency/clients' },
];

/** How often a domain still being set up is asked about: DNS and certificates take minutes. */
export const DOMAIN_POLL_MS = 15_000;
