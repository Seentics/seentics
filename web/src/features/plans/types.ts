export type Plan = {
  id: string;
  name: string;
  /** `free`, or `pro` ($15 a month; past its included amounts with Extra usage, an add-on). */
  tier: 'free' | 'pro';
  description: string | null;
  priceMonthly: number;
  /** Which suite products this plan grants access to, e.g. ['core', 'observe']. */
  products: string[];
  features: string[];
  /**
   * Per-product numeric limits, e.g. limits.observe.storage_gb. -1 means unlimited; a metered
   * resource also has its included amount, e.g. limits.core.included_monthly_events.
   */
  limits: Record<string, Record<string, number>>;
};
