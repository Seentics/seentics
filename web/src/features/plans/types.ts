export type Plan = {
  id: string;
  name: string;
  /** `free`, `analytics` ($9 a month) or `pro` ($19 a month; past its included amounts with Extra usage, an add-on). */
  tier: 'free' | 'analytics' | 'pro';
  description: string | null;
  priceMonthly: number;
  /** The price of a year, billed at once ($84, $168); null when the plan is not sold yearly. */
  priceYearly: number | null;
  /** Which suite products this plan grants access to, e.g. ['core', 'observe']. */
  products: string[];
  features: string[];
  /**
   * Per-product numeric limits, e.g. limits.observe.storage_gb. -1 means unlimited; a metered
   * resource also has its included amount, e.g. limits.core.included_monthly_events.
   */
  limits: Record<string, Record<string, number>>;
};

/** How a plan is billed. */
export type BillingInterval = 'month' | 'year';
