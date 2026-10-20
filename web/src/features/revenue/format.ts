/** Date, time and compact-number formatting for revenue views. Pure. */
import type { Locale } from '@/lib/i18n';

export function fmtDate(iso: string, locale?: Locale) {
  try { return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); }
  catch { return iso; }
}

export function fmtTime(iso: string, locale?: Locale, dateStyle: 'medium' | 'full' = 'medium') {
  try { return new Date(iso).toLocaleString(undefined, { dateStyle, timeStyle: 'short' }); }
  catch { return iso; }
}

export function fmtK(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

/** One order line, as the order views render it. `price` is per unit; `null` when not sent. */
export type LineItem = { sku: string; name: string; qty: number; price: number | null };

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v.trim()) : typeof v === 'number' ? v : NaN;
  return v !== '' && Number.isFinite(n) ? n : null;
};
const str = (...vs: unknown[]) => {
  for (const v of vs) if ((typeof v === 'string' && v.trim()) || typeof v === 'number') return String(v).trim();
  return '';
};

/**
 * An order's line items, from whatever shape the site sent.
 *
 * `items` is the site's own JSON, stored as sent: the documented `{ sku, name, qty, price }`
 * and GA4's `{ item_id, item_name, quantity, price }` are both common. Reading only the
 * first rendered a GA4 order as nameless lines whose totals were `NaN`. Without items, the
 * order's product stands in as one line at the order's value.
 */
export function lineItems(tx: { items?: unknown; product_name?: string; value: number }): LineItem[] {
  const raw = Array.isArray(tx.items) ? tx.items : [];
  const items = raw
    .filter((it): it is Record<string, unknown> => !!it && typeof it === 'object')
    .map((it) => ({
      sku: str(it.sku, it.item_id, it.id, it.product_id),
      name: str(it.name, it.item_name, it.product_name, it.title, it.sku, it.item_id) || '—',
      qty: Math.max(0, num(it.qty ?? it.quantity) ?? 1),
      price: num(it.price ?? it.item_price ?? it.unit_price),
    }));
  if (items.length) return items;
  return tx.product_name ? [{ sku: '', name: tx.product_name, qty: 1, price: tx.value }] : [];
}
