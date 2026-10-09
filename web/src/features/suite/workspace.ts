import type { Entitlements } from './types';

/**
 * Whether the sidebar's Workspace switcher offers `product` (observe). Every plan — Free and
 * Pay-As-You-Go — covers every product, so it is offered whenever the account has a grant for it.
 */
export function workspaceIncludes(entitlements: Entitlements, product: string): boolean {
  return Boolean(entitlements.products[product]);
}
