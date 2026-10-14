import type { DeliveryStatus, ProviderId } from '@/features/integrations/types';

/** Where one submission was sent, and how that went. */
export type SubmissionDelivery = {
  /** The delivery's own id: what a retry is addressed to. */
  id: string;
  connection_id: string;
  connection_name: string;
  provider: ProviderId;
  status: DeliveryStatus;
  attempt_count: number;
  error: string | null;
  completed_at: string | null;
};

/** The reward the server drew for a spin wheel or coupon popup. */
export type SubmissionPrize = { id: string; label: string; coupon_code: string | null };

/** One form submission, as listed on the automation's page. */
export type Submission = {
  id: string;
  email: string;
  name: string;
  phone: string;
  consent: boolean;
  fields: Record<string, string | number | boolean>;
  prize: SubmissionPrize | null;
  variant: string | null;
  page_url: string;
  referrer: string;
  created_at: string;
  deliveries: SubmissionDelivery[];
};

export type SubmissionFilters = { search: string; limit: number; offset: number };
export type SubmissionPage = { submissions: Submission[]; total: number };

export type FormSummary = {
  total: number;
  last_7_days: number;
  last_30_days: number;
  by_variant: { variant: string | null; count: number }[];
  with_prize: number;
};
