import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api', () => ({ default: { post } }));

import { rememberCheckoutIntent, startCheckout, startInvoiceCheckout, takeCheckoutIntent } from '@/lib/checkout';

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
    await startCheckout('agency', 'month', 'FOUNDING30');
    expect(post).toHaveBeenLastCalledWith('/user/billing/checkout', { plan: 'agency', interval: 'month', discount: 'FOUNDING30' });
    await startCheckout('pro', 'year', 'FOUNDING30');
    expect(post).toHaveBeenLastCalledWith('/user/billing/checkout', { plan: 'pro', interval: 'year', discount: 'FOUNDING30' });
  });

  it('carries the claimed code across sign-up', () => {
    rememberCheckoutIntent('agency', 'year', 'FOUNDING30');
    expect(takeCheckoutIntent()).toEqual({ plan: 'agency', interval: 'year', discount: 'FOUNDING30' });
    rememberCheckoutIntent('pro', 'year');
    expect(takeCheckoutIntent()).toEqual({ plan: 'pro', interval: 'year' });
  });
});

describe('paying in taka', () => {
  it('carries the choice across sign-up, and only when made', () => {
    rememberCheckoutIntent('pro', 'month', undefined, true);
    expect(takeCheckoutIntent()).toEqual({ plan: 'pro', interval: 'month', manual: true });
    rememberCheckoutIntent('pro', 'month');
    expect(takeCheckoutIntent()).toEqual({ plan: 'pro', interval: 'month' });
  });

  it('creates an invoice and opens its page', async () => {
    post.mockResolvedValueOnce({ data: { data: { id: 'inv-1', number: 'SN-2610-0001' } } });
    await startInvoiceCheckout('starter', 'year');
    expect(post).toHaveBeenLastCalledWith('/user/billing/invoices', { plan: 'starter', interval: 'year' });
    expect(window.location.assign).toHaveBeenLastCalledWith('/billing/invoice?id=inv-1');
  });
});
