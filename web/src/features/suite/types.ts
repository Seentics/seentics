export type ProductEntitlement = {
  plan: string;
  tier: 'free' | 'starter' | 'pro' | 'business';
  limits: Record<string, number>;
};

/**
 * A user always has an entry for every registered product (falling back to
 * that product's free tier) — "not included" isn't a concept any more, only
 * "at what tier". See gateway's billing/entitlements.ts for the full
 * resolution rules (a user can hold several concurrent subscriptions;
 * limits merge most-generous-wins).
 */
export type Entitlements = {
  products: Record<string, ProductEntitlement>;
};
