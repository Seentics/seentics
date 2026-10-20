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
  /**
   * The same plan in whole taka, paid with bKash, Nagad or Rocket in Bangladesh (৳499 / ৳1,499 /
   * ৳5,999 a month, ten months for a year). Null, or absent from an older gateway, when it is not
   * sold in taka.
   */
  priceMonthlyBdt?: number | null;
  priceYearlyBdt?: number | null;
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

/**
 * The founding offer's spots, from gateway's GET /api/v1/billing/founding: Lemon Squeezy's redemption
 * count of the founding code. `claimed` and `left` are null when the count is unknown.
 */
export type FoundingSpots = {
  code: string;
  total: number;
  claimed: number | null;
  left: number | null;
  status: 'open' | 'closed';
};
