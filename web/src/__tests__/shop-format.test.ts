import { describe, expect, it } from 'vitest';
import { blankPage, formatBdt, nextStatuses, normalisePhone, pageProblems, slugify, slugProblem, telHref } from '@/features/shop/format';
import { demoOrderSummary, demoOrdersPage, DEMO_PAGES } from '@/lib/demo/shop';
import { en } from '@/lib/i18n/messages/en';
import { bn } from '@/lib/i18n/messages/bn';

describe('shop format', () => {
  it('writes taka grouped as in Bangladesh', () => {
    expect(formatBdt(1499)).toBe('৳1,499');
    expect(formatBdt(100000)).toBe('৳1,00,000');
  });

  it('checks store and page addresses as Core does', () => {
    expect(slugProblem('rupa-fashion')).toBeNull();
    expect(slugProblem('')).toBe('empty');
    expect(slugProblem('ab')).toBe('format');
    expect(slugProblem('-rupa')).toBe('format');
    expect(slugProblem('Rupa')).toBe('format');
    expect(slugProblem('api')).toBe('reserved');
    expect(slugify("Rupa's Fashion House")).toBe('rupas-fashion-house');
    expect(slugify('রুপা ফ্যাশন')).toBe('');
  });

  it('takes Bangladeshi numbers with +880, spaces and dashes', () => {
    expect(normalisePhone('+880 1711-000000')).toBe('01711000000');
    expect(normalisePhone('01711000000')).toBe('01711000000');
    expect(normalisePhone('01211000000')).toBeNull();
    expect(telHref('01711000000')).toBe('tel:+8801711000000');
  });

  it('moves orders forward, and closed ones back to new', () => {
    expect(nextStatuses('new')).toEqual(['confirmed', 'cancelled', 'fake']);
    expect(nextStatuses('delivered')).toEqual(['returned']);
    expect(nextStatuses('fake')).toEqual(['new']);
  });

  it('a blank page needs everything, a demo page nothing', () => {
    expect(pageProblems(blankPage())).toEqual(expect.arrayContaining(['slug', 'title', 'productName', 'price', 'images']));
    const { id: _id, url: _u, status: _s, createdAt: _c, updatedAt: _up, publishedAt: _p, ...input } = DEMO_PAGES[0]!;
    expect(pageProblems(input)).toEqual([]);
    expect(pageProblems({ ...input, comparePrice: input.price })).toEqual(['comparePrice']);
  });
});

describe('demo shop', () => {
  it('filters orders and adds up the summary', () => {
    const all = demoOrdersPage({ status: '', risk: '', q: '', page: 0, limit: 500 });
    const high = demoOrdersPage({ status: '', risk: 'high', q: '', page: 0, limit: 500 });
    const summary = demoOrderSummary();
    expect(all.total).toBeGreaterThan(20);
    expect(high.items.every((o) => o.risk.level === 'high')).toBe(true);
    expect(summary.byRisk.high).toBe(high.total);
    expect(Object.values(summary.byStatus).reduce((a, b) => a + b, 0)).toBe(all.total);
    // Every number is in the reserved demo range.
    expect(all.items.every((o) => o.phone.startsWith('01700000'))).toBe(true);
  });
});

describe('shop strings', () => {
  it('has a Bangla string for every status and risk level', () => {
    for (const s of Object.keys(en.shop.orders.statuses)) expect(bn.shop.orders.statuses[s as keyof typeof bn.shop.orders.statuses]).toBeTruthy();
    expect(Object.keys(bn.shop.orders.risk)).toEqual(Object.keys(en.shop.orders.risk));
  });
});
