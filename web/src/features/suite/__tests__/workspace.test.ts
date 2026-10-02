import { describe, expect, it } from 'vitest';

import type { Entitlements, ProductEntitlement } from '../types';
import { workspaceIncludes } from '../workspace';

const grant = (planId: string, tier: ProductEntitlement['tier']): ProductEntitlement => ({ plan: planId, tier, planId, limits: {} });

const free: Entitlements = {
  products: { core: grant('core-free', 'free'), observe: grant('observe-free', 'free'), uptime: grant('uptime-free', 'free') },
};

describe('workspaceIncludes', () => {
  it('offers the other apps to a free account — the free Suite', () => {
    expect(workspaceIncludes(free, 'uptime')).toBe(true);
    expect(workspaceIncludes(free, 'observe')).toBe(true);
  });

  it('offers them on a paid Suite plan', () => {
    const suite: Entitlements = {
      products: { core: grant('suite-pro', 'pro'), observe: grant('suite-pro', 'pro'), uptime: grant('suite-pro', 'pro') },
    };
    expect(workspaceIncludes(suite, 'uptime')).toBe(true);
    expect(workspaceIncludes(suite, 'observe')).toBe(true);
  });

  it('hides them from a customer who bought Analytics on its own', () => {
    const analyticsOnly: Entitlements = { products: { ...free.products, core: grant('core-pro', 'pro') } };
    expect(workspaceIncludes(analyticsOnly, 'uptime')).toBe(false);
    expect(workspaceIncludes(analyticsOnly, 'observe')).toBe(false);
  });

  it('still offers an app that customer bought separately', () => {
    const both: Entitlements = { products: { ...free.products, core: grant('core-pro', 'pro'), uptime: grant('uptime-starter', 'starter') } };
    expect(workspaceIncludes(both, 'uptime')).toBe(true);
    expect(workspaceIncludes(both, 'observe')).toBe(false);
  });

  it('offers nothing this build does not know', () => {
    expect(workspaceIncludes(free, 'status')).toBe(false);
  });
});
