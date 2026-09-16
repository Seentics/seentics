export type Plan = {
  id: string;
  name: string;
  tier: 'free' | 'pro' | 'business' | 'enterprise';
  description: string | null;
  priceMonthly: number;
  priceYearly: number;
  isBundle: boolean;
  /** Which suite products this plan grants access to, e.g. ['core', 'uptime']. */
  products: string[];
  features: string[];
  /** Per-product numeric limits, e.g. limits.uptime.max_monitors. -1 means unlimited. */
  limits: Record<string, Record<string, number>>;
};
