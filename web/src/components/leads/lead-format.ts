/** Words and small mappings the Leads page shows, kept in one place so the tabs and the drawer agree. */
import type { ContactSource, ContactStatus, LeadChannel } from '@/features/leads/types';

export const CHANNEL_LABEL: Record<LeadChannel, string> = {
  paid: 'Paid ads',
  email: 'Email',
  social: 'Social',
  organic: 'Search',
  campaign: 'Campaign',
  internal: 'Internal',
  referral: 'Referral',
  direct: 'Direct',
};

/** Statuses as a short pipeline; the dot is the only colour, and only the two end states carry one. */
export const STATUS_META: Record<ContactStatus, { label: string; dot: string }> = {
  new:       { label: 'New',       dot: 'bg-muted-foreground/50' },
  contacted: { label: 'Contacted', dot: 'bg-muted-foreground/80' },
  qualified: { label: 'Qualified', dot: 'bg-foreground' },
  customer:  { label: 'Customer',  dot: 'bg-emerald-500' },
  lost:      { label: 'Lost',      dot: 'bg-rose-500/70' },
};

export const SOURCE_LABEL: Record<ContactSource, string> = { form: 'Form', manual: 'Added by hand', import: 'Imported' };

/** "Paid ads · spring_sale", or just the channel. */
export function cameFrom(channel: LeadChannel | null, campaign?: string | null): string {
  if (!channel) return '—';
  return campaign ? `${CHANNEL_LABEL[channel]} · ${campaign}` : CHANNEL_LABEL[channel];
}

/** Rolling windows the submissions list can show; submissions are kept 90 days, so that is "all". */
export const SUBMISSION_RANGES = [
  { days: 7, label: 'Last 7 days' },
  { days: 30, label: 'Last 30 days' },
  { days: 90, label: 'Last 90 days' },
] as const;

/** Saves a downloaded blob under `filename`. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
