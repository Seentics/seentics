/**
 * The Shop: a seller's store on seentics.shop, its product landing pages with a cash-on-delivery
 * order form, and the orders those pages take. Shapes as Core's shop module returns them
 * (docs/shop.md in seentics-cloud is the contract).
 */

export type PurchaseEventOn = 'placed' | 'confirmed' | 'delivered';

export type Store = {
  websiteId: string;
  slug: string;
  name: string;
  /** https://seentics.shop/<slug> */
  url: string;
  phone: string | null;
  whatsapp: string | null;
  facebookUrl: string | null;
  logoUrl: string | null;
  /** Taka. */
  deliveryInsideDhaka: number;
  deliveryOutsideDhaka: number;
  /** When Facebook (and the other ad platforms) are told about a Purchase. */
  purchaseEventOn: PurchaseEventOn;
  /** High-risk orders are kept but marked cancelled at once, instead of only labelled. */
  autoBlockHighRisk: boolean;
  steadfastConnected: boolean;
  createdAt: string;
};

export type StoreInput = Omit<Store, 'websiteId' | 'url' | 'steadfastConnected' | 'createdAt'>;

export const TEMPLATES = ['classic', 'bold', 'minimal', 'offer'] as const;
export type Template = (typeof TEMPLATES)[number];

export type PageStatus = 'draft' | 'published';

export type ProductPage = {
  id: string;
  slug: string;
  url: string;
  status: PageStatus;
  template: Template;
  /** #rrggbb */
  accent: string;
  title: string;
  productName: string;
  price: number;
  comparePrice: number | null;
  images: string[];
  description: string;
  highlights: string[];
  faq: Array<{ q: string; a: string }>;
  options: { label: string; values: string[] } | null;
  maxQuantity: number;
  freeDelivery: boolean;
  thankYouMessage: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
};

export type PageInput = Omit<ProductPage, 'id' | 'url' | 'status' | 'createdAt' | 'updatedAt' | 'publishedAt'>;

export const ORDER_STATUSES = ['new', 'confirmed', 'shipped', 'delivered', 'returned', 'cancelled', 'fake'] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const RISK_LEVELS = ['safe', 'check', 'high'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export type ConversionStatus = 'not_sent' | 'queued' | 'sent' | 'failed' | 'skipped';

export type Order = {
  id: string;
  number: string;
  pageId: string | null;
  pageSlug: string | null;
  productName: string;
  option: string | null;
  quantity: number;
  unitPrice: number;
  deliveryCharge: number;
  total: number;
  customerName: string;
  phone: string;
  address: string;
  area: 'inside_dhaka' | 'outside_dhaka';
  district: string | null;
  note: string | null;
  status: OrderStatus;
  risk: { level: RiskLevel; score: number; reasons: Array<{ code: string; text: string }>; checkedAt: string };
  courier: {
    steadfast: { total: number; delivered: number; cancelled: number; successRate: number | null; checkedAt: string } | null;
  };
  conversion: { status: ConversionStatus; event: 'Purchase' | null; at: string | null };
  sessionId: string | null;
  hasReplay: boolean;
  history: Array<{ status: OrderStatus; at: string; by: string | null }>;
  sellerNote: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OrderFilters = { status: OrderStatus | ''; risk: RiskLevel | ''; q: string; page: number; limit: number };
export type OrderPage = { items: Order[]; page: number; limit: number; total: number };

export type OrderSummary = {
  byStatus: Record<OrderStatus, number>;
  byRisk: Record<RiskLevel, number>;
  /** Delivered orders' totals, taka. */
  revenueBdt: number;
  confirmedBdt: number;
};

export type BlacklistEntry = { id: string; phone: string; reason: string | null; createdAt: string };

export type SteadfastKeys = { apiKey: string; secretKey: string };
