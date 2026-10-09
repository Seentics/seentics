export type Plan = {
  id: string;
  name: string;
  /** `free` (hard limits) or `payg` ($15 a month, usage past the included amounts billed). */
  tier: 'free' | 'payg';
  description: string | null;
  priceMonthly: number;
  isBundle: boolean;
  /** Which suite products this plan grants access to, e.g. ['core', 'observe']. */
  products: string[];
  features: string[];
  /**
   * Per-product numeric limits, e.g. limits.observe.storage_gb. -1 means unlimited; a metered
   * resource also has its included amount, e.g. limits.core.included_monthly_events.
   */
  limits: Record<string, Record<string, number>>;
};
