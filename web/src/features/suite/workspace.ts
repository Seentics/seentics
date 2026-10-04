import type { Entitlements, ProductEntitlement } from './types';

const isSuitePlan = (grant?: ProductEntitlement) => grant?.planId?.startsWith('suite-') ?? false;
const isFree = (grant?: ProductEntitlement) => !grant || grant.tier === 'free';

/**
 * Whether the sidebar's Workspace switcher offers `product` (observe).
 *
 * Shown on a Suite plan, free included: every user without a subscription
 * holds the free tier of every product, which is the free Suite. Hidden from
 * a customer who bought Analytics on its own — their Observability
 * is only the free fallback, not something they chose — unless they bought
 * that product separately too.
 */
export function workspaceIncludes(entitlements: Entitlements, product: string): boolean {
  const grant = entitlements.products[product];
  if (!grant) return false;
  if (isSuitePlan(grant) || !isFree(grant)) return true;
  const analytics = entitlements.products.core;
  return isSuitePlan(analytics) || isFree(analytics);
}
