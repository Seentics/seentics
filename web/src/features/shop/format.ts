/** Helpers the shop's pages share: money, slugs, phone numbers, and what a status allows next. */
import type { OrderStatus, PageInput } from './types';

/** Whole taka, grouped as in Bangladesh: ৳1,499, ৳1,00,000. */
export const formatBdt = (taka: number) => `৳${Math.round(taka).toLocaleString('en-IN')}`;

/** A store or page address segment (docs/shop.md): 3–40 of a–z, 0–9 and inner dashes. */
export const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])$/;

/** Words the shop host keeps for itself; Core refuses them too. */
export const RESERVED_SLUGS = new Set(['api', 'admin', 'static', 'assets', 'www', 'seentics', 'help', 'app', 'shop', 'store', 'login', 'signin', 'signup', 'order', 'orders']);

export function slugProblem(slug: string): 'empty' | 'format' | 'reserved' | null {
  if (!slug) return 'empty';
  if (!SLUG_RE.test(slug)) return 'format';
  if (RESERVED_SLUGS.has(slug)) return 'reserved';
  return null;
}

/** A name as an address: "Rupa's Fashion" → "rupas-fashion". Latin only; Bangla names give ''. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/g, '');
}

/** 01XXXXXXXXX → tel:+8801XXXXXXXXX. */
export const telHref = (phone: string) => `tel:${phone.startsWith('0') ? `+88${phone}` : phone}`;

export const HEX_RE = /^#[0-9a-f]{6}$/i;

/**
 * Where an order can go from here: the next step forward, and the ways out. Delivered can still be
 * returned; an order already closed can be reopened as new (a mistake undone).
 */
export function nextStatuses(status: OrderStatus): OrderStatus[] {
  switch (status) {
    case 'new': return ['confirmed', 'cancelled', 'fake'];
    case 'confirmed': return ['shipped', 'delivered', 'cancelled', 'fake'];
    case 'shipped': return ['delivered', 'returned'];
    case 'delivered': return ['returned'];
    case 'returned':
    case 'cancelled':
    case 'fake': return ['new'];
  }
}

/** A new page's starting point: enough to preview, nothing published. */
export function blankPage(accent = '#16a34a'): PageInput {
  return {
    slug: '',
    template: 'classic',
    accent,
    title: '',
    productName: '',
    price: 0,
    comparePrice: null,
    images: [],
    description: '',
    highlights: [],
    faq: [],
    options: null,
    maxQuantity: 5,
    freeDelivery: false,
    thankYouMessage: null,
  };
}

/** What a page editor needs filled in before it can be saved. */
export function pageProblems(p: PageInput): Array<'slug' | 'title' | 'productName' | 'price' | 'images' | 'accent' | 'comparePrice'> {
  const out: Array<'slug' | 'title' | 'productName' | 'price' | 'images' | 'accent' | 'comparePrice'> = [];
  if (slugProblem(p.slug)) out.push('slug');
  if (!p.title.trim()) out.push('title');
  if (!p.productName.trim()) out.push('productName');
  if (!(p.price > 0)) out.push('price');
  if (p.comparePrice !== null && !(p.comparePrice > p.price)) out.push('comparePrice');
  if (p.images.length === 0) out.push('images');
  if (!HEX_RE.test(p.accent)) out.push('accent');
  return out;
}

/** "2 hours ago" / "2 ঘণ্টা আগে", digits Latin in both, as the rest of the product writes them. */
export function timeAgo(iso: string, locale: 'en' | 'bn', now = Date.now()): string {
  const ms = new Date(iso).getTime() - now;
  if (Number.isNaN(ms)) return '—';
  const rtf = new Intl.RelativeTimeFormat(locale === 'bn' ? 'bn-BD-u-nu-latn' : 'en', { numeric: 'auto' });
  const abs = Math.abs(ms);
  if (abs < 60_000) return rtf.format(0, 'second');
  if (abs < 3_600_000) return rtf.format(Math.round(ms / 60_000), 'minute');
  if (abs < 86_400_000) return rtf.format(Math.round(ms / 3_600_000), 'hour');
  if (abs < 30 * 86_400_000) return rtf.format(Math.round(ms / 86_400_000), 'day');
  return new Date(iso).toLocaleDateString(locale === 'bn' ? 'bn-BD-u-nu-latn' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Date and time in Dhaka, for history lines: "20 Oct, 3:40 pm". */
export function dhakaTime(iso: string, locale: 'en' | 'bn'): string {
  return new Date(iso).toLocaleString(locale === 'bn' ? 'bn-BD-u-nu-latn' : 'en-GB', {
    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Dhaka',
  });
}

/** A Bangladeshi mobile number as Core stores it (01XXXXXXXXX), or null: +880, spaces and dashes allowed. */
export function normalisePhone(raw: string): string | null {
  const n = raw.replace(/[\s-]/g, '').replace(/^\+?880/, '0');
  return /^01[3-9]\d{8}$/.test(n) ? n : null;
}
