import { describe, expect, it } from 'bun:test';
import { looksPersonal, maskPath, maskText } from '..';

describe('maskPath', () => {
  it('drops the query string, the fragment and the origin', () => {
    expect(maskPath('/pricing?utm_source=x&email=a@b.co#plans')).toBe('/pricing');
    expect(maskPath('https://shop.example.com/cart?id=5')).toBe('/cart');
    expect(maskPath('')).toBe('/');
    expect(maskPath(null)).toBe('/');
  });

  it('masks ids and emails in segments, and keeps the route', () => {
    expect(maskPath('/orders/884213/invoice')).toBe('/orders/:id/invoice');
    expect(maskPath('/users/ada%40example.com/settings')).toBe('/users/:email/settings');
    expect(maskPath('/p/3f2c9a10-1b2c-4d5e-8f90-123456789abc')).toBe('/p/:id');
    expect(maskPath('/blog/why-real-time-matters')).toBe('/blog/why-real-time-matters');
    expect(maskPath('/pricing/')).toBe('/pricing');
  });
});

describe('maskPath: tokens, numbers and generated ids in segments', () => {
  it('masks a token, a phone number or a long number in a segment', () => {
    expect(maskPath('/auth/eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0/done')).toBe('/auth/:id/done');
    expect(maskPath('/s/Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5MGFiY2RlZg')).toBe('/s/:id');
    expect(maskPath('/call/+1-555-123-4567')).toBe('/call/:id');
    expect(maskPath('/track/order-99887766')).toBe('/track/:id');
  });

  it('masks a high-entropy mixed letter and digit segment', () => {
    expect(maskPath('/share/a8F3kd92')).toBe('/share/:id');
    expect(maskPath('/c/x7Kq9pLm2/view')).toBe('/c/:id/view');
    expect(maskPath('/d/AbcdEfgh1234')).toBe('/d/:id');
  });

  it('masks the segment after a prefix that names a person or a credential', () => {
    expect(maskPath('/reset/hello-world')).toBe('/reset/:id');
    expect(maskPath('/verify/abc')).toBe('/verify/:id');
    expect(maskPath('/invite/team-ada/accept')).toBe('/invite/:id/accept');
    expect(maskPath('/token/x')).toBe('/token/:id');
    expect(maskPath('/u/ada')).toBe('/u/:id');
    expect(maskPath('/user/ada/settings')).toBe('/user/:id/settings');
  });

  it('keeps ordinary routes, slugs and dates', () => {
    expect(maskPath('/products/iphone15-pro-max')).toBe('/products/iphone15-pro-max');
    expect(maskPath('/blog/top-10-tips-for-growing-your-small-business-in-2026')).toBe('/blog/top-10-tips-for-growing-your-small-business-in-2026');
    expect(maskPath('/blog/2026-10-13/launch')).toBe('/blog/2026-10-13/launch');
    expect(maskPath('/docs/v2/getting-started')).toBe('/docs/v2/getting-started');
    expect(maskPath('/checkout/step2')).toBe('/checkout/step2');
  });
});

describe('maskText', () => {
  it('replaces emails, ids, tokens, addresses and long numbers, and keeps the words', () => {
    const out = maskText('Failed for ada@example.com (user 3f2c9a10-1b2c-4d5e-8f90-123456789abc) from 203.0.113.9 order 99887766');
    expect(out).toBe('Failed for [email] (user [id]) from [ip] order [number]');
    expect(maskText('Bearer abc.def-ghi_123 rejected')).toBe('Bearer [token] rejected');
    expect(maskText('Call +1 555 123 4567 now')).toContain('[number]');
  });

  it('limits the length and collapses whitespace', () => {
    expect(maskText('a   b\n c')).toBe('a b c');
    expect(maskText('word '.repeat(100), 40)).toHaveLength(40);
    // A long unbroken run is a token, and is masked rather than quoted.
    expect(maskText('x'.repeat(500), 40)).toBe('[token]');
    expect(maskText(null)).toBe('');
  });
});

describe('looksPersonal', () => {
  it('flags an email, an IP, a phone number or an id', () => {
    expect(looksPersonal('Ask ada@example.com')).toBe(true);
    expect(looksPersonal('From 203.0.113.9')).toBe(true);
    expect(looksPersonal('Ring +1 555 123 4567')).toBe(true);
    expect(looksPersonal('user 3f2c9a10-1b2c-4d5e-8f90-123456789abc')).toBe(true);
  });

  it('does not flag figures and dates a dashboard line states', () => {
    expect(looksPersonal('Visitors fell 28% over the last 7 days: 3,100 against 4,300.')).toBe(false);
    expect(looksPersonal('Since 2026-10-13 conversion fell 1.2% to 0.8%.')).toBe(false);
    expect(looksPersonal('Mobile checkout: 34 of 2,400 sessions (1.4%).')).toBe(false);
  });
});
