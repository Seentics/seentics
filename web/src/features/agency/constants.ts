import type { AgencyClient, AgencyClientFeatures, ClientUser } from './types';

/**
 * Shared vocabulary for the agency screens.
 *
 * Five pages each declared their own copies of these. `STATUS_STYLES` was byte-identical
 * across the three client pages and `FEATURE_LABELS` across two of them — the sort of
 * duplication that stays correct right up until someone edits one of them.
 *
 * The variants that genuinely differ are kept apart and named for how they differ, rather
 * than merged behind a flag: a list row wants a label, a detail page wants a label and an
 * explanation, and clients and client-users do not share a status set.
 */

/** Clients can be archived; client-users cannot, which is why these are two maps. */
export const CLIENT_STATUS_STYLES: Record<AgencyClient['status'], string> = {
  active:    'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800',
  suspended: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
  archived:  'bg-muted text-muted-foreground border-border',
};

export const USER_STATUS_STYLES: Record<ClientUser['status'], string> = {
  active:    'bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800',
  suspended: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
};

export const CLIENT_FEATURE_LABELS: Array<{ key: keyof AgencyClientFeatures; label: string }> = [
  { key: 'analytics',   label: 'Analytics' },
  { key: 'heatmaps',    label: 'Heatmaps' },
  { key: 'replays',     label: 'Replays' },
  { key: 'funnels',     label: 'Funnels' },
  { key: 'automations', label: 'Automations' },
];

export const DEFAULT_CLIENT_FEATURES: AgencyClientFeatures = {
  analytics: true,
  heatmaps: true,
  replays: true,
  funnels: true,
  automations: true,
};
