/** Which price ladder a plan belongs to — one pricing tab each. */
export type PlanFamily = 'suite' | 'core' | 'observe';

export const PLAN_FAMILY_LABEL: Record<PlanFamily, string> = {
  suite: 'Suite',
  core: 'Analytics',
  observe: 'Observability',
};

export type Plan = {
  id: string;
  /** Absent from gateways older than migration 019 — use `planFamily()`. */
  family?: PlanFamily;
  name: string;
  tier: 'free' | 'starter' | 'pro' | 'business';
  description: string | null;
  priceMonthly: number;
  priceYearly: number;
  isBundle: boolean;
  /** Which suite products this plan grants access to, e.g. ['core', 'observe']. */
  products: string[];
  features: string[];
  /** Per-product numeric limits, e.g. limits.observe.storage_gb. -1 means unlimited. */
  limits: Record<string, Record<string, number>>;
};

export function planFamily(plan: Plan): PlanFamily {
  return plan.family ?? (plan.isBundle ? 'suite' : ((plan.products[0] ?? 'core') as PlanFamily));
}
