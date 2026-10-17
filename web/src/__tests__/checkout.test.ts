import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({ default: { post } }));

import { rememberCheckoutIntent, startCheckout, takeCheckoutIntent } from '@/lib/checkout';

beforeEach(() => {
  post.mockReset().mockResolvedValue({ data: { data: { checkoutUrl: 'https://pay.test/c' } } });
  // jsdom's location can't be spied on; a stand-in with `assign` is enough for openCheckout.
  vi.stubGlobal('location', { ...window.location, assign: vi.fn() });
  localStorage.clear();
});

afterEach(() => vi.unstubAllGlobals());

describe('checkout with the founding code', () => {
  it('sends `discount` only when one was claimed', async () => {
    await startCheckout('agency', 'year');
    expect(post).toHaveBeenLastCalledWith('/user/billing/checkout', { plan: 'agency', interval: 'year' });
    await startCheckout('agency', 'month', 'FOUNDING49');
    expect(post).toHaveBeenLastCalledWith('/user/billing/checkout', { plan: 'agency', interval: 'month', discount: 'FOUNDING49' });
  });

  it('carries the claimed code across sign-up', () => {
    rememberCheckoutIntent('agency', 'month', 'FOUNDING49');
    expect(takeCheckoutIntent()).toEqual({ plan: 'agency', interval: 'month', discount: 'FOUNDING49' });
    rememberCheckoutIntent('pro', 'year');
    expect(takeCheckoutIntent()).toEqual({ plan: 'pro', interval: 'year' });
  });
});
