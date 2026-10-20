import type { ModuleLifecycle } from "../../../app/module";
import type { AuthedRouter, PublicRouter } from "../../../platform/http/router";
import type { AdContext } from "../../integrations/interfaces";

/**
 * Public contracts for the shop module (docs/shop.md): a seller's store, its product landing
 * pages with a cash-on-delivery form, the orders they take, and how risky each order looks.
 *
 * A store is a website: one is created with it, so its pages' analytics, heatmaps, replays and
 * server-side conversions are that website's and nothing in those modules knows about shops.
 */

export const TEMPLATES = ["classic", "bold", "minimal", "offer"] as const;
export type Template = (typeof TEMPLATES)[number];

export const ORDER_STATUSES = ["new", "confirmed", "shipped", "delivered", "returned", "cancelled", "fake"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const RISK_LEVELS = ["safe", "check", "high"] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export type PurchaseTrigger = "placed" | "confirmed" | "delivered";
export type Area = "inside_dhaka" | "outside_dhaka";

export type Store = {
  websiteId: string;
  slug: string;
  name: string;
  url: string;
  phone: string | null;
  whatsapp: string | null;
  facebookUrl: string | null;
  logoUrl: string | null;
  deliveryInsideDhaka: number;
  deliveryOutsideDhaka: number;
  purchaseEventOn: PurchaseTrigger;
  autoBlockHighRisk: boolean;
  steadfastConnected: boolean;
  createdAt: string;
};

export type StoreInput = {
  slug: string;
  name: string;
  phone: string | null;
  whatsapp: string | null;
  facebookUrl: string | null;
  logoUrl: string | null;
  deliveryInsideDhaka: number;
  deliveryOutsideDhaka: number;
  purchaseEventOn: PurchaseTrigger;
  autoBlockHighRisk: boolean;
};

export type PageOptions = { label: string; values: string[] } | null;

export type Page = {
  id: string;
  slug: string;
  url: string;
  status: "draft" | "published";
  template: Template;
  accent: string;
  title: string;
  productName: string;
  price: number;
  comparePrice: number | null;
  images: string[];
  description: string;
  highlights: string[];
  faq: Array<{ q: string; a: string }>;
  options: PageOptions;
  maxQuantity: number;
  freeDelivery: boolean;
  thankYouMessage: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
};

export type PageInput = Omit<Page, "id" | "url" | "status" | "createdAt" | "updatedAt" | "publishedAt">;

export type RiskReason = { code: string; text: string };
export type Risk = { level: RiskLevel; score: number; reasons: RiskReason[]; checkedAt: string };

export type CourierRecord = { total: number; delivered: number; cancelled: number; successRate: number | null; checkedAt: string };

export type ConversionState = "not_sent" | "queued" | "sent" | "failed" | "skipped";

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
  area: Area;
  district: string | null;
  note: string | null;
  status: OrderStatus;
  risk: Risk;
  courier: { steadfast: CourierRecord | null };
  conversion: { status: ConversionState; event: "Purchase" | null; at: string | null };
  sessionId: string | null;
  hasReplay: boolean;
  history: Array<{ status: OrderStatus; at: string; by: string | null }>;
  sellerNote: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BlacklistEntry = { id: string; phone: string; reason: string | null; createdAt: string };

/** What a buyer's browser sends, already validated and cleaned. */
export type OrderSubmission = {
  pageId: string;
  name: string;
  phone: string;
  address: string;
  area: Area;
  district: string | null;
  quantity: number;
  option: string | null;
  note: string | null;
  anonymousId: string | null;
  sessionId: string | null;
  ad: AdContext | null;
  pageUrl: string | null;
  clientIp: string;
  userAgent: string;
};

/**
 * The ports the shop needs from its peers, each declared here by the consumer.
 */

/** Creating the website a store is backed by, and removing it again if the store cannot be made. */
export interface ShopWebsites {
  create(ownerId: string, input: { name: string; url: string }): Promise<{ id: string }>;
  delete(websiteId: string): Promise<boolean>;
  getRole(websiteId: string, userId: string): Promise<"owner" | "admin" | "member" | "viewer" | null>;
}

/** The order the ad platforms hear about as a Purchase: one per order, ever. */
export type OrderPurchase = {
  websiteId: string;
  orderId: string;
  value: number;
  currency: "BDT";
  /** E.164 digits, 880…, before hashing. */
  phone: string;
  occurredAt: number;
  url: string;
  visitorId: string | null;
  ip: string;
  userAgent: string;
  ad: AdContext | null;
};

/** The integrations module's side of verified purchases. */
export interface OrderPurchaseSink {
  /** Queues the Purchase to every destination that sends purchases; the number queued. */
  enqueueOrderPurchase(p: OrderPurchase): Promise<number>;
  /** Where each order's Purchase stands now, by order id: the worst of its destinations'. Missing: nothing queued (or aged out). */
  orderPurchaseStatus(websiteId: string, orderIds: readonly string[]): Promise<Map<string, "queued" | "sent" | "failed">>;
}

/** Sealing a seller's courier keys, with the same keys conversion credentials use. */
export interface CredentialSealer {
  seal(plaintext: string, context: string): string;
  open(ciphertext: string, context: string): string;
}

/** Whether an order's session was recorded, for "watch" in the order drawer. */
export interface SessionPresence {
  recorded(websiteId: string, sessionIds: readonly string[]): Promise<Set<string>>;
}

export interface ShopModule extends ModuleLifecycle {
  /** The dashboard: stores, pages, images, orders, blacklist, courier keys. */
  routes: AuthedRouter;
  /** What the gateway serves on the shop host: pages, images and the order form's submit. */
  publicRoutes: PublicRouter;
}
