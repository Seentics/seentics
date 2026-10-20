import { sql } from "../../../db";
import type { Page, PageInput, PurchaseTrigger, Store, StoreInput, Template } from "../interfaces";

/**
 * Stores and their pages. SQL for `shop_stores` and `shop_pages` lives here and nowhere else.
 *
 * Timestamps come back from the shared client as text (Drizzle replaces its date parsers), so
 * they are read through `iso` whichever form arrives.
 */

export const iso = (v: unknown): string => (v instanceof Date ? v.toISOString() : new Date(String(v)).toISOString());
const isoOrNull = (v: unknown): string | null => (v == null ? null : iso(v));

type StoreRow = {
  website_id: string; slug: string; name: string; phone: string | null; whatsapp: string | null; facebook_url: string | null;
  logo_url: string | null; delivery_inside_dhaka: number; delivery_outside_dhaka: number; purchase_event_on: PurchaseTrigger;
  auto_block_high_risk: boolean; steadfast_credentials: string | null; created_at: unknown;
};

export type StoreRecord = Store & { ownerId: string; steadfastCredentials: string | null };

function toStore(r: StoreRow & { owner_id: string }, publicUrl: string): StoreRecord {
  return {
    websiteId: r.website_id,
    ownerId: r.owner_id,
    slug: r.slug,
    name: r.name,
    url: `${publicUrl}/${r.slug}`,
    phone: r.phone,
    whatsapp: r.whatsapp,
    facebookUrl: r.facebook_url,
    logoUrl: r.logo_url,
    deliveryInsideDhaka: r.delivery_inside_dhaka,
    deliveryOutsideDhaka: r.delivery_outside_dhaka,
    purchaseEventOn: r.purchase_event_on,
    autoBlockHighRisk: r.auto_block_high_risk,
    steadfastConnected: r.steadfast_credentials !== null,
    steadfastCredentials: r.steadfast_credentials,
    createdAt: iso(r.created_at),
  };
}

/** Postgres' unique violation, for "that slug is taken". */
export const isUniqueViolation = (e: unknown): boolean => (e as { code?: string })?.code === "23505";

export class ShopRepository {
  constructor(private readonly publicUrl: string) {}

  async insertStore(websiteId: string, ownerId: string, input: { name: string; slug: string }): Promise<StoreRecord> {
    const [row] = await sql<(StoreRow & { owner_id: string })[]>`
      INSERT INTO shop_stores (website_id, owner_id, slug, name) VALUES (${websiteId}::uuid, ${ownerId}::uuid, ${input.slug}, ${input.name})
      RETURNING *`;
    return toStore(row!, this.publicUrl);
  }

  async storeByWebsite(websiteId: string): Promise<StoreRecord | null> {
    const [row] = await sql<(StoreRow & { owner_id: string })[]>`SELECT * FROM shop_stores WHERE website_id = ${websiteId}::uuid`;
    return row ? toStore(row, this.publicUrl) : null;
  }

  async storeBySlug(slug: string): Promise<StoreRecord | null> {
    const [row] = await sql<(StoreRow & { owner_id: string })[]>`SELECT * FROM shop_stores WHERE slug = ${slug}`;
    return row ? toStore(row, this.publicUrl) : null;
  }

  async updateStore(websiteId: string, patch: Partial<StoreInput>): Promise<StoreRecord | null> {
    const cols: Record<string, unknown> = {};
    if (patch.slug !== undefined) cols.slug = patch.slug;
    if (patch.name !== undefined) cols.name = patch.name;
    if (patch.phone !== undefined) cols.phone = patch.phone;
    if (patch.whatsapp !== undefined) cols.whatsapp = patch.whatsapp;
    if (patch.facebookUrl !== undefined) cols.facebook_url = patch.facebookUrl;
    if (patch.logoUrl !== undefined) cols.logo_url = patch.logoUrl;
    if (patch.deliveryInsideDhaka !== undefined) cols.delivery_inside_dhaka = patch.deliveryInsideDhaka;
    if (patch.deliveryOutsideDhaka !== undefined) cols.delivery_outside_dhaka = patch.deliveryOutsideDhaka;
    if (patch.purchaseEventOn !== undefined) cols.purchase_event_on = patch.purchaseEventOn;
    if (patch.autoBlockHighRisk !== undefined) cols.auto_block_high_risk = patch.autoBlockHighRisk;
    if (Object.keys(cols).length === 0) return this.storeByWebsite(websiteId);
    const [row] = await sql<(StoreRow & { owner_id: string })[]>`
      UPDATE shop_stores SET ${sql(cols)}, updated_at = NOW() WHERE website_id = ${websiteId}::uuid RETURNING *`;
    return row ? toStore(row, this.publicUrl) : null;
  }

  async setSteadfastCredentials(websiteId: string, sealed: string | null): Promise<boolean> {
    const rows = await sql`UPDATE shop_stores SET steadfast_credentials = ${sealed}, updated_at = NOW() WHERE website_id = ${websiteId}::uuid RETURNING 1`;
    return rows.length > 0;
  }

  /** The next order number for a store, taken atomically. */
  async takeOrderNumber(websiteId: string): Promise<number> {
    const [row] = await sql<{ n: number }[]>`
      UPDATE shop_stores SET next_order_number = next_order_number + 1 WHERE website_id = ${websiteId}::uuid
      RETURNING next_order_number - 1 AS n`;
    if (!row) throw new Error("store not found");
    return row.n;
  }

  // ── Pages ────────────────────────────────────────────────────────────────

  private toPage(r: PageRow, storeSlug: string): Page {
    return {
      id: r.id,
      slug: r.slug,
      url: `${this.publicUrl}/${storeSlug}/${r.slug}`,
      status: r.status,
      template: r.template,
      accent: r.accent,
      title: r.title,
      productName: r.product_name,
      price: r.price,
      comparePrice: r.compare_price,
      images: Array.isArray(r.images) ? r.images.map(String) : [],
      description: r.description,
      highlights: Array.isArray(r.highlights) ? r.highlights.map(String) : [],
      faq: Array.isArray(r.faq) ? r.faq : [],
      options: r.options ?? null,
      maxQuantity: r.max_quantity,
      freeDelivery: r.free_delivery,
      thankYouMessage: r.thank_you_message,
      createdAt: iso(r.created_at),
      updatedAt: iso(r.updated_at),
      publishedAt: isoOrNull(r.published_at),
    };
  }

  async listPages(websiteId: string, storeSlug: string, onlyPublished = false): Promise<Page[]> {
    const rows = onlyPublished
      ? await sql<PageRow[]>`SELECT * FROM shop_pages WHERE website_id = ${websiteId}::uuid AND status = 'published' ORDER BY published_at DESC`
      : await sql<PageRow[]>`SELECT * FROM shop_pages WHERE website_id = ${websiteId}::uuid ORDER BY created_at DESC`;
    return rows.map((r) => this.toPage(r, storeSlug));
  }

  async page(websiteId: string, storeSlug: string, pageId: string): Promise<Page | null> {
    const [row] = await sql<PageRow[]>`SELECT * FROM shop_pages WHERE website_id = ${websiteId}::uuid AND id = ${pageId}::uuid`;
    return row ? this.toPage(row, storeSlug) : null;
  }

  async pageBySlug(websiteId: string, storeSlug: string, slug: string): Promise<Page | null> {
    const [row] = await sql<PageRow[]>`SELECT * FROM shop_pages WHERE website_id = ${websiteId}::uuid AND slug = ${slug}`;
    return row ? this.toPage(row, storeSlug) : null;
  }

  /** A page by id alone, with its store: the order form's submit carries only the page id. */
  async pageWithStore(pageId: string): Promise<{ page: Page; store: StoreRecord } | null> {
    const [row] = await sql<(PageRow & { store_slug: string })[]>`
      SELECT p.*, s.slug AS store_slug FROM shop_pages p JOIN shop_stores s ON s.website_id = p.website_id WHERE p.id = ${pageId}::uuid`;
    if (!row) return null;
    const store = await this.storeByWebsite(row.website_id);
    return store ? { page: this.toPage(row, row.store_slug), store } : null;
  }

  async insertPage(websiteId: string, storeSlug: string, p: PageInput): Promise<Page> {
    const [row] = await sql<PageRow[]>`
      INSERT INTO shop_pages (website_id, slug, template, accent, title, product_name, price, compare_price, images, description,
        highlights, faq, options, max_quantity, free_delivery, thank_you_message)
      VALUES (${websiteId}::uuid, ${p.slug}, ${p.template}, ${p.accent}, ${p.title}, ${p.productName}, ${p.price}, ${p.comparePrice},
        ${JSON.stringify(p.images)}::jsonb, ${p.description}, ${JSON.stringify(p.highlights)}::jsonb, ${JSON.stringify(p.faq)}::jsonb,
        ${p.options ? JSON.stringify(p.options) : null}::jsonb, ${p.maxQuantity}, ${p.freeDelivery}, ${p.thankYouMessage})
      RETURNING *`;
    return this.toPage(row!, storeSlug);
  }

  async updatePage(websiteId: string, storeSlug: string, pageId: string, p: Partial<PageInput>): Promise<Page | null> {
    const cols: Record<string, unknown> = {};
    const json = (v: unknown) => sql.json(v as never);
    if (p.slug !== undefined) cols.slug = p.slug;
    if (p.template !== undefined) cols.template = p.template;
    if (p.accent !== undefined) cols.accent = p.accent;
    if (p.title !== undefined) cols.title = p.title;
    if (p.productName !== undefined) cols.product_name = p.productName;
    if (p.price !== undefined) cols.price = p.price;
    if (p.comparePrice !== undefined) cols.compare_price = p.comparePrice;
    if (p.images !== undefined) cols.images = json(p.images);
    if (p.description !== undefined) cols.description = p.description;
    if (p.highlights !== undefined) cols.highlights = json(p.highlights);
    if (p.faq !== undefined) cols.faq = json(p.faq);
    if (p.options !== undefined) cols.options = p.options ? json(p.options) : null;
    if (p.maxQuantity !== undefined) cols.max_quantity = p.maxQuantity;
    if (p.freeDelivery !== undefined) cols.free_delivery = p.freeDelivery;
    if (p.thankYouMessage !== undefined) cols.thank_you_message = p.thankYouMessage;
    if (Object.keys(cols).length === 0) return this.page(websiteId, storeSlug, pageId);
    const [row] = await sql<PageRow[]>`
      UPDATE shop_pages SET ${sql(cols)}, updated_at = NOW() WHERE website_id = ${websiteId}::uuid AND id = ${pageId}::uuid RETURNING *`;
    return row ? this.toPage(row, storeSlug) : null;
  }

  async setPageStatus(websiteId: string, storeSlug: string, pageId: string, status: "draft" | "published"): Promise<Page | null> {
    const [row] = await sql<PageRow[]>`
      UPDATE shop_pages SET status = ${status}, updated_at = NOW(),
        published_at = CASE WHEN ${status} = 'published' THEN COALESCE(published_at, NOW()) ELSE published_at END
      WHERE website_id = ${websiteId}::uuid AND id = ${pageId}::uuid RETURNING *`;
    return row ? this.toPage(row, storeSlug) : null;
  }

  async deletePage(websiteId: string, pageId: string): Promise<boolean> {
    const rows = await sql`DELETE FROM shop_pages WHERE website_id = ${websiteId}::uuid AND id = ${pageId}::uuid RETURNING 1`;
    return rows.length > 0;
  }
}

type PageRow = {
  id: string; website_id: string; slug: string; status: "draft" | "published"; template: Template; accent: string; title: string;
  product_name: string; price: number; compare_price: number | null; images: unknown; description: string; highlights: unknown;
  faq: Array<{ q: string; a: string }>; options: { label: string; values: string[] } | null; max_quantity: number;
  free_delivery: boolean; thank_you_message: string | null; created_at: unknown; updated_at: unknown; published_at: unknown;
};
