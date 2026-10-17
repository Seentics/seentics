export type Plan = {
  id: string;
  name: string;
  /**
   * `free`, `starter` ($9 a month), `pro` ($24) or `agency` ($99; client workspaces and
   * embeds). Pro and Agency go past their included amounts with Extra usage, an add-on.
   */
  tier: 'free' | 'starter' | 'pro' | 'agency';
  description: string | null;
  priceMonthly: number;
  /** The price of a year, billed at once ($90, $240, $990); null when the plan is not sold yearly. */
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
