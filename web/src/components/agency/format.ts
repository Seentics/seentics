import type { AgencyClient, AgencyClientFeatures, ClientLimits } from '@/features/agency/types';

/** 250000 → "250k", 1500 → "1.5k". Caps are round numbers; this keeps table cells short. */
export function compactNumber(n: number): string {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

export const FEATURE_NAMES: Record<keyof AgencyClientFeatures, string> = {
  analytics: 'Analytics',
  heatmaps: 'Heatmaps',
  replays: 'Recordings',
  funnels: 'Funnels',
  automations: 'Automations',
  errors: 'Errors',
};

export function disabledFeatures(client: AgencyClient): (keyof AgencyClientFeatures)[] {
  return (Object.keys(FEATURE_NAMES) as (keyof AgencyClientFeatures)[]).filter(k => !client.featuresEnabled[k]);
}

/** The caps that are set, as short phrases: ["250k events", "2k recordings"]. */
export function limitPhrases(limits: ClientLimits): string[] {
  const out: string[] = [];
  if (limits.maxMonthlyEvents !== null) out.push(`${compactNumber(limits.maxMonthlyEvents)} events`);
  if (limits.maxReplays !== null) out.push(`${compactNumber(limits.maxReplays)} recordings`);
  if (limits.maxHeatmaps !== null) out.push(`${compactNumber(limits.maxHeatmaps)} heatmaps`);
  if (limits.maxWebsites !== null) out.push(`${limits.maxWebsites} sites`);
  return out;
}

/** "Bloom & Co" → "BC": words that start with a letter or digit only. */
export const initials = (name: string) =>
  name.split(/\s+/).filter(w => /^[\p{L}\p{N}]/u.test(w)).slice(0, 2).map(w => w[0]!.toUpperCase()).join('') || '?';
