import type { DomainState, EmbedSection, FeatureAccess, FeatureId, InstallMethod, Resource, SetupStepId } from './types';

/** The dashboard pages a client can be shown, in sidebar order, with what each one holds. */
export const FEATURES: Array<{ id: FeatureId; label: string; description: string }> = [
  { id: 'overview', label: 'Overview', description: 'Visitors, pages, sources and countries' },
  { id: 'events', label: 'Events', description: 'Custom events and their properties' },
  { id: 'paths', label: 'Paths', description: 'How visitors move between pages' },
  { id: 'revenue', label: 'Revenue', description: 'Sales and where they came from' },
  { id: 'recordings', label: 'Recordings', description: 'Replays of real visitor sessions' },
  { id: 'heatmaps', label: 'Heatmaps', description: 'Clicks and scroll depth on each page' },
  { id: 'funnels', label: 'Funnels', description: 'Where visitors drop out of a flow' },
  { id: 'goals', label: 'Goals', description: 'Conversions the site counts' },
  { id: 'automations', label: 'Automations', description: 'Popups, emails and webhooks' },
  { id: 'leads', label: 'Leads', description: 'Form submissions and contacts' },
  { id: 'conversions', label: 'Conversions', description: 'Sales and leads sent to ad platforms' },
  { id: 'ai', label: 'AI', description: 'Questions and written reports' },
  { id: 'errors', label: 'Errors', description: 'JavaScript errors visitors hit' },
  { id: 'privacy', label: 'Privacy', description: 'Consent and data settings' },
];

export const FEATURE_IDS: FeatureId[] = FEATURES.map(f => f.id);

export const FEATURE_ACCESS: Array<{ id: FeatureAccess; label: string }> = [
  { id: 'off', label: 'Off' },
  { id: 'view', label: 'View' },
  { id: 'edit', label: 'Edit' },
];

export const RESOURCES: Array<{ id: Resource; label: string }> = [
  { id: 'events', label: 'Events' },
  { id: 'recordings', label: 'Recordings' },
  { id: 'leads', label: 'Leads' },
  { id: 'ai_analyses', label: 'AI analyses' },
];

export const INSTALL_METHODS: Array<{ id: InstallMethod; label: string }> = [
  { id: 'html', label: 'HTML' },
  { id: 'gtm', label: 'Google Tag Manager' },
  { id: 'nextjs', label: 'Next.js' },
  { id: 'wordpress', label: 'WordPress' },
  { id: 'shopify', label: 'Shopify' },
  { id: 'npm', label: 'npm' },
];

export const EMBED_SECTIONS: Array<{ id: EmbedSection; label: string; description: string }> = [
  { id: 'analytics', label: 'Analytics', description: 'Traffic, pages, sources, countries and devices' },
  { id: 'recordings', label: 'Session recordings', description: 'Replays of real visitor sessions' },
  { id: 'heatmaps', label: 'Heatmaps', description: 'Clicks, movement and scroll on each page' },
];

/** The setup guide, in order: what each step is and where it is done. */
export const SETUP_STEPS: Array<{ id: SetupStepId; title: string; description: string; href: string; cta: string; later?: string }> = [
  { id: 'branding', title: 'Add your brand and domain', description: 'Your name, logo and colour, and a domain such as reports.youragency.com.', href: '/agency/branding', cta: 'Open branding' },
  { id: 'first_client', title: 'Add your first client', description: 'A client groups the websites you run for one customer.', href: '/agency/clients?new=1', cta: 'Add a client' },
  { id: 'website_installed', title: 'Add a website and install the snippet', description: 'Add the client’s site, paste the snippet, and check that events arrive.', href: '/agency/websites', cta: 'Add a website' },
  { id: 'client_user', title: 'Invite a client user', description: 'Let your client sign in to their own dashboard.', href: '/agency/clients', cta: 'Open clients', later: 'Client sign-in arrives in the next update.' },
  { id: 'features_limits', title: 'Choose features and limits', description: 'Pick which dashboard pages each client sees. Limits arrive in a later update.', href: '/agency/clients', cta: 'Open clients' },
];

export const DOMAIN_STATES: Record<DomainState, { label: string; hint: string }> = {
  pending_dns: { label: 'Waiting for DNS', hint: 'Add the records below at your DNS provider. This page checks again every 15 seconds.' },
  pending_certificate: { label: 'Issuing certificate', hint: 'DNS is set. The HTTPS certificate usually takes a few minutes.' },
  active: { label: 'Active', hint: 'Your domain is live.' },
  failed: { label: 'Failed', hint: 'Check the records below, then check again, or remove the domain and start over.' },
};

/** How often a domain still being set up is asked about: DNS and certificates take minutes. */
export const DOMAIN_POLL_MS = 15_000;
