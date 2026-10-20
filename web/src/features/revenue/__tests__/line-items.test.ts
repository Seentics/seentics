import { describe, expect, it } from 'vitest';
import { lineItems } from '@/features/revenue/format';

describe('lineItems', () => {
  it('reads the documented shape', () => {
    expect(lineItems({ value: 80, items: [{ sku: 's1', name: 'Seat', qty: 2, price: 40 }] }))
      .toEqual([{ sku: 's1', name: 'Seat', qty: 2, price: 40 }]);
  });

  it("reads GA4's item_id / item_name / quantity without NaN", () => {
    expect(lineItems({ value: 30, items: [{ item_id: 'g1', item_name: 'Mug', quantity: '3', price: '10' }] }))
      .toEqual([{ sku: 'g1', name: 'Mug', qty: 3, price: 10 }]);
  });

  it('leaves a missing price as null rather than NaN, and a missing qty as one', () => {
    const [first] = lineItems({ value: 5, items: [{ name: 'Gift' }] });
    expect(first).toEqual({ sku: '', name: 'Gift', qty: 1, price: null });
  });

  it('falls back to the product as one line at the order value', () => {
    expect(lineItems({ value: 49, product_name: 'Pro' })).toEqual([{ sku: '', name: 'Pro', qty: 1, price: 49 }]);
    expect(lineItems({ value: 49 })).toEqual([]);
    expect(lineItems({ value: 49, items: ['junk', null] })).toEqual([]);
  });
});
