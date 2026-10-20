/** Small mappings the Leads page shows, kept in one place so the tabs and the drawer agree. Words are in `useT().leads`. */
import type { ContactStatus, LeadChannel } from '@/features/leads/types';
import type { LeadsMessages } from '@/lib/i18n/messages/leads-en';

/** Statuses as a short pipeline; the dot is the only colour, and only the two end states carry one. Labels: `leads.statuses`. */
export const STATUS_META: Record<ContactStatus, { dot: string }> = {
  new:       { dot: 'bg-muted-foreground/50' },
  contacted: { dot: 'bg-muted-foreground/80' },
  qualified: { dot: 'bg-foreground' },
  customer:  { dot: 'bg-emerald-500' },
  lost:      { dot: 'bg-rose-500/70' },
};

/** "Paid ads · spring_sale", or just the channel. */
export function cameFrom(t: LeadsMessages, channel: LeadChannel | null, campaign?: string | null): string {
  if (!channel) return '—';
  return campaign ? `${t.channels[channel]} · ${campaign}` : t.channels[channel];
}

/** Rolling windows the submissions list can show; submissions are kept 90 days, so that is "all". Labels: `leads.ranges`. */
export const SUBMISSION_RANGES = [7, 30, 90] as const;

/** Saves a downloaded blob under `filename`. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
