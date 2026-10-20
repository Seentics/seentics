/**
 * The demo site as a Facebook seller's store: two product pages and a month of cash-on-delivery
 * orders, some of them fake. Names are made up and every phone number is in the unassigned
 * 01700-000xxx range, so nothing here reaches a real person.
 */
import type {
  BlacklistEntry, Order, OrderFilters, OrderPage, OrderStatus, OrderSummary, ProductPage, RiskLevel, Store,
} from '@/features/shop/types';
import { ORDER_STATUSES, RISK_LEVELS } from '@/features/shop/types';
import { createDemoRandom, demoDate } from './fixture-utils';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const iso = (offsetMs: number) => demoDate(offsetMs).toISOString();

/** A flat product picture, so the demo needs no image host. */
function swatch(color: string, label: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800"><rect width="800" height="800" fill="${color}"/><text x="400" y="420" font-family="sans-serif" font-size="64" fill="#fff" text-anchor="middle">${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const DEMO_STORE: Store = {
  websiteId: 'demo',
  slug: 'rupa-fashion',
  name: 'Rupa Fashion',
  url: 'https://seentics.shop/rupa-fashion',
  phone: '01700000100',
  whatsapp: '01700000100',
  facebookUrl: 'https://facebook.com/',
  logoUrl: null,
  deliveryInsideDhaka: 60,
  deliveryOutsideDhaka: 120,
  purchaseEventOn: 'confirmed',
  autoBlockHighRisk: false,
  steadfastConnected: true,
  createdAt: iso(-40 * DAY),
};

export const DEMO_PAGES: ProductPage[] = [
  {
    id: 'demo-page-1',
    slug: 'cotton-three-piece',
    url: 'https://seentics.shop/rupa-fashion/cotton-three-piece',
    status: 'published',
    template: 'classic',
    accent: '#be185d',
    title: 'ঈদের জন্য আরামদায়ক কটন থ্রি-পিস',
    productName: 'Cotton Three-Piece',
    price: 1450,
    comparePrice: 1950,
    images: [swatch('#be185d', 'Three-Piece'), swatch('#9d174d', 'Back')],
    description: 'নরম সুতি কাপড়, গরমেও আরাম।\nসেলাই মজবুত, রং পাকা।',
    highlights: ['১০০% কটন', 'সব সাইজ পাওয়া যায়', 'ঢাকায় ২৪ ঘণ্টায় ডেলিভারি'],
    faq: [{ q: 'পণ্য হাতে পেয়ে টাকা দেওয়া যাবে?', a: 'হ্যাঁ, ক্যাশ অন ডেলিভারি। দেখে নিয়ে টাকা দিন।' }],
    options: { label: 'সাইজ', values: ['M', 'L', 'XL'] },
    maxQuantity: 5,
    freeDelivery: false,
    thankYouMessage: 'অর্ডারের জন্য ধন্যবাদ! আমরা শিগগিরই কল করে কনফার্ম করব।',
    createdAt: iso(-38 * DAY),
    updatedAt: iso(-3 * DAY),
    publishedAt: iso(-38 * DAY),
  },
  {
    id: 'demo-page-2',
    slug: 'smart-watch',
    url: 'https://seentics.shop/rupa-fashion/smart-watch',
    status: 'draft',
    template: 'offer',
    accent: '#2563eb',
    title: 'অফার! স্মার্ট ওয়াচ এখন অর্ধেক দামে',
    productName: 'Smart Watch',
    price: 990,
    comparePrice: 1990,
    images: [swatch('#2563eb', 'Watch')],
    description: 'হার্ট রেট, স্টেপ কাউন্ট, নোটিফিকেশন।',
    highlights: ['৭ দিনের ব্যাটারি', 'ওয়াটারপ্রুফ'],
    faq: [],
    options: null,
    maxQuantity: 3,
    freeDelivery: true,
    thankYouMessage: null,
    createdAt: iso(-5 * DAY),
    updatedAt: iso(-1 * DAY),
    publishedAt: null,
  },
];

const NAMES = ['Nusrat Jahan', 'Rakib Hasan', 'Sumaiya Akter', 'Tanvir Ahmed', 'Farzana Rahman', 'Mahmudul Islam', 'Sadia Afrin', 'Arif Hossain', 'Mim Chowdhury', 'Shakil Khan'];
const PLACES: Array<[string, 'inside_dhaka' | 'outside_dhaka', string | null]> = [
  ['House 12, Road 5, Mirpur 10', 'inside_dhaka', 'Dhaka'],
  ['Flat 3B, Dhanmondi 27', 'inside_dhaka', 'Dhaka'],
  ['Agrabad, Chattogram', 'outside_dhaka', 'Chattogram'],
  ['Zindabazar, Sylhet', 'outside_dhaka', 'Sylhet'],
  ['Uttara Sector 7', 'inside_dhaka', 'Dhaka'],
  ['Kushtia sadar', 'outside_dhaka', 'Kushtia'],
];

function buildOrders(): Order[] {
  const rand = createDemoRandom('demo-shop-orders');
  const orders: Order[] = [];
  for (let i = 0; i < 46; i += 1) {
    const age = Math.floor(rand() * 28 * DAY) + i * 600_000;
    const roll = rand();
    const status: OrderStatus = age < DAY ? 'new'
      : roll < 0.55 ? 'delivered' : roll < 0.68 ? 'shipped' : roll < 0.78 ? 'confirmed' : roll < 0.86 ? 'returned' : roll < 0.94 ? 'cancelled' : 'fake';
    const fakeish = status === 'fake' || (status === 'new' && rand() < 0.25);
    const [address, area, district] = PLACES[Math.floor(rand() * PLACES.length)]!;
    const quantity = 1 + Math.floor(rand() * 2);
    const unitPrice = DEMO_PAGES[0]!.price;
    const deliveryCharge = area === 'inside_dhaka' ? DEMO_STORE.deliveryInsideDhaka : DEMO_STORE.deliveryOutsideDhaka;
    const level: RiskLevel = fakeish ? 'high' : rand() < 0.2 ? 'check' : 'safe';
    const reasons = level === 'high'
      ? [{ code: 'duplicate_phone', text: '২৪ ঘণ্টায় এই নম্বর থেকে আরেকটি অর্ডার' }, { code: 'courier_low_success', text: 'Courier-এ ডেলিভারি সফল মাত্র ৩০%' }]
      : level === 'check'
        ? [{ code: 'new_customer', text: 'নতুন কাস্টমার, আগে কোনো অর্ডার নেই' }, { code: 'short_address', text: 'ঠিকানা খুব ছোট' }]
        : [{ code: 'past_delivered', text: 'আগে ২টি অর্ডার ডেলিভারি হয়েছে' }];
    const created = iso(-age);
    const history: Order['history'] = [{ status: 'new', at: created, by: null }];
    if (status !== 'new') history.push({ status, at: iso(-age + 6 * HOUR), by: 'rupa@example.com' });
    const sent = ['confirmed', 'shipped', 'delivered', 'returned'].includes(status);
    orders.push({
      id: `demo-order-${i + 1}`,
      number: String(1100 - i),
      pageId: 'demo-page-1',
      pageSlug: 'cotton-three-piece',
      productName: 'Cotton Three-Piece',
      option: ['M', 'L', 'XL'][i % 3]!,
      quantity,
      unitPrice,
      deliveryCharge,
      total: unitPrice * quantity + deliveryCharge,
      customerName: NAMES[i % NAMES.length]!,
      phone: `01700000${String(200 + (fakeish ? 1 : i)).padStart(3, '0')}`,
      address,
      area,
      district,
      note: i % 7 === 0 ? 'বিকেলে কল দিবেন' : null,
      status,
      risk: { level, score: level === 'high' ? 78 : level === 'check' ? 42 : 12, reasons, checkedAt: created },
      courier: {
        steadfast: level === 'high'
          ? { total: 10, delivered: 3, cancelled: 7, successRate: 30, checkedAt: created }
          : { total: 4, delivered: 4, cancelled: 0, successRate: 100, checkedAt: created },
      },
      conversion: sent
        ? { status: 'sent', event: 'Purchase', at: iso(-age + 6 * HOUR) }
        : status === 'cancelled' || status === 'fake' ? { status: 'skipped', event: null, at: null } : { status: 'not_sent', event: null, at: null },
      // The one demo session with a recording behind it (demo/replays).
      sessionId: i === 0 ? 'demo-session-4821' : null,
      hasReplay: i === 0,
      history,
      sellerNote: null,
      createdAt: created,
      updatedAt: history[history.length - 1]!.at,
    });
  }
  return orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

const ORDERS = buildOrders();

export function demoOrdersPage(f: OrderFilters): OrderPage {
  const q = f.q.trim().toLowerCase();
  const items = ORDERS.filter((o) =>
    (!f.status || o.status === f.status)
    && (!f.risk || o.risk.level === f.risk)
    && (!q || o.number.includes(q) || o.phone.includes(q) || o.customerName.toLowerCase().includes(q)));
  return { items: items.slice(f.page * f.limit, (f.page + 1) * f.limit), page: f.page, limit: f.limit, total: items.length };
}

export const demoOrder = (id: string): Order | null => ORDERS.find((o) => o.id === id) ?? null;

export function demoOrderSummary(): OrderSummary {
  const byStatus = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0])) as Record<OrderStatus, number>;
  const byRisk = Object.fromEntries(RISK_LEVELS.map((r) => [r, 0])) as Record<RiskLevel, number>;
  let revenueBdt = 0;
  let confirmedBdt = 0;
  for (const o of ORDERS) {
    byStatus[o.status] += 1;
    byRisk[o.risk.level] += 1;
    if (o.status === 'delivered') revenueBdt += o.total;
    if (o.status === 'confirmed' || o.status === 'shipped') confirmedBdt += o.total;
  }
  return { byStatus, byRisk, revenueBdt, confirmedBdt };
}

export const DEMO_BLACKLIST: BlacklistEntry[] = [
  { id: 'demo-bl-1', phone: '01700000201', reason: 'তিনবার অর্ডার করে রিসিভ করেনি', createdAt: iso(-12 * DAY) },
];
