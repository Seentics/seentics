import { describe, expect, it } from 'vitest';

import type { Entitlements, ProductEntitlement } from '../types';
import { workspaceIncludes } from '../workspace';

const grant = (planId: string, tier: ProductEntitlement['tier']): ProductEntitlement => ({ plan: planId, tier, planId, limits: {} });

describe('workspaceIncludes', () => {
  it('offers the other apps on Free and on Pay-As-You-Go: every plan covers every product', () => {
    const free: Entitlements = { products: { core: grant('free', 'free'), observe: grant('free', 'free') } };
    const payg: Entitlements = { products: { core: grant('payg', 'payg'), observe: grant('payg', 'payg') } };
    expect(workspaceIncludes(free, 'observe')).toBe(true);
    expect(workspaceIncludes(payg, 'observe')).toBe(true);
  });

  it('offers nothing this build does not know', () => {
    expect(workspaceIncludes({ products: { core: grant('free', 'free') } }, 'status')).toBe(false);
  });
});
