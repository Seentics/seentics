import { randomBytes } from "node:crypto";
import { log } from "../../../platform/observability/logger";
import type { CredentialSealer, Page, PageInput, ShopWebsites, Store, StoreInput } from "../interfaces";
import { IMAGE_ID, MAX_IMAGE_BYTES, imageKey, sniffImage } from "../lib/images";
import { type SteadfastKeys, steadfastKeysWork } from "../lib/steadfast";
import { isUniqueViolation, type ShopRepository, type StoreRecord } from "../repositories/shop.repository";

const shop_log = log.child({ category: "shop" });

/** Where product photos are kept. A port, so the services run in tests without S3. */
export interface ImageStore {
  put(key: string, body: Uint8Array, contentType: string): Promise<void>;
  get(key: string): Promise<{ body: Uint8Array; contentType: string | null } | null>;
}

const publicStore = ({ ownerId: _o, steadfastCredentials: _s, ...store }: StoreRecord): Store => store;

/** What a sealed courier secret is bound to: this store's Steadfast keys, nowhere else. */
export const steadfastContext = (websiteId: string) => `shop:steadfast:${websiteId}`;

export type StoreResult<T> = { ok: true; value: T } | { ok: false; error: "slug_taken" | "not_found" | "invalid_credentials" | "unavailable" };

/**
 * A seller's store and its product pages.
 *
 * Creating a store creates its website first, on the shop host, so the tracker on its pages is
 * accepted for it; when the store row then cannot be made (its slug was taken meanwhile) the
 * website is removed again, so a failed attempt leaves nothing behind.
 */
export class StoreService {
  constructor(
    private readonly repo: ShopRepository,
    private readonly websites: ShopWebsites,
    private readonly images: ImageStore,
    private readonly sealer: CredentialSealer | null,
    private readonly shopHost: string,
    private readonly publicUrl: string,
    private readonly send: typeof fetch = fetch,
  ) {}

  async create(ownerId: string, input: { name: string; slug: string }): Promise<StoreResult<{ store: Store; websiteId: string }>> {
    if (await this.repo.storeBySlug(input.slug)) return { ok: false, error: "slug_taken" };
    const website = await this.websites.create(ownerId, { name: input.name, url: this.shopHost });
    try {
      const store = await this.repo.insertStore(website.id, ownerId, input);
      shop_log.info({ msg: "shop_store_created", website_id: website.id, slug: input.slug });
      return { ok: true, value: { store: publicStore(store), websiteId: website.id } };
    } catch (err) {
      await this.websites.delete(website.id).catch(() => false);
      if (isUniqueViolation(err)) return { ok: false, error: "slug_taken" };
      throw err;
    }
  }

  async get(websiteId: string): Promise<Store | null> {
    const store = await this.repo.storeByWebsite(websiteId);
    return store ? publicStore(store) : null;
  }

  async record(websiteId: string): Promise<StoreRecord | null> {
    return this.repo.storeByWebsite(websiteId);
  }

  async update(websiteId: string, patch: Partial<StoreInput>): Promise<StoreResult<Store>> {
    try {
      const store = await this.repo.updateStore(websiteId, patch);
      return store ? { ok: true, value: publicStore(store) } : { ok: false, error: "not_found" };
    } catch (err) {
      if (isUniqueViolation(err)) return { ok: false, error: "slug_taken" };
      throw err;
    }
  }

  /** Connect (checked against Steadfast first) or disconnect (`null`) the store's courier keys. */
  async setSteadfast(websiteId: string, keys: SteadfastKeys | null): Promise<StoreResult<{ connected: boolean }>> {
    if (keys === null) {
      const done = await this.repo.setSteadfastCredentials(websiteId, null);
      return done ? { ok: true, value: { connected: false } } : { ok: false, error: "not_found" };
    }
    if (!this.sealer) return { ok: false, error: "unavailable" };
    if (!(await steadfastKeysWork(keys, this.send))) return { ok: false, error: "invalid_credentials" };
    const sealed = this.sealer.seal(JSON.stringify(keys), steadfastContext(websiteId));
    const done = await this.repo.setSteadfastCredentials(websiteId, sealed);
    return done ? { ok: true, value: { connected: true } } : { ok: false, error: "not_found" };
  }

  /** The store's Steadfast keys, opened; null when none are stored or they cannot be opened. */
  steadfastKeys(store: StoreRecord): SteadfastKeys | null {
    if (!store.steadfastCredentials || !this.sealer) return null;
    try {
      return JSON.parse(this.sealer.open(store.steadfastCredentials, steadfastContext(store.websiteId))) as SteadfastKeys;
    } catch {
      shop_log.warn({ msg: "shop_steadfast_keys_unreadable", website_id: store.websiteId });
      return null;
    }
  }

  // ── Pages ────────────────────────────────────────────────────────────────

  async pages(websiteId: string): Promise<Page[] | null> {
    const store = await this.repo.storeByWebsite(websiteId);
    return store ? this.repo.listPages(websiteId, store.slug) : null;
  }

  async page(websiteId: string, pageId: string): Promise<Page | null> {
    const store = await this.repo.storeByWebsite(websiteId);
    return store ? this.repo.page(websiteId, store.slug, pageId) : null;
  }

  async createPage(websiteId: string, input: PageInput): Promise<StoreResult<Page>> {
    const store = await this.repo.storeByWebsite(websiteId);
    if (!store) return { ok: false, error: "not_found" };
    try {
      return { ok: true, value: await this.repo.insertPage(websiteId, store.slug, input) };
    } catch (err) {
      if (isUniqueViolation(err)) return { ok: false, error: "slug_taken" };
      throw err;
    }
  }

  async updatePage(websiteId: string, pageId: string, patch: Partial<PageInput>): Promise<StoreResult<Page>> {
    const store = await this.repo.storeByWebsite(websiteId);
    if (!store) return { ok: false, error: "not_found" };
    try {
      const page = await this.repo.updatePage(websiteId, store.slug, pageId, patch);
      return page ? { ok: true, value: page } : { ok: false, error: "not_found" };
    } catch (err) {
      if (isUniqueViolation(err)) return { ok: false, error: "slug_taken" };
      throw err;
    }
  }

  async setPageStatus(websiteId: string, pageId: string, status: "draft" | "published"): Promise<Page | null> {
    const store = await this.repo.storeByWebsite(websiteId);
    return store ? this.repo.setPageStatus(websiteId, store.slug, pageId, status) : null;
  }

  deletePage(websiteId: string, pageId: string): Promise<boolean> {
    return this.repo.deletePage(websiteId, pageId);
  }

  // ── Images ───────────────────────────────────────────────────────────────

  /** Store a product photo; its public URL on the shop host. Only real JPEG, PNG or WebP, up to 3 MB. */
  async uploadImage(websiteId: string, bytes: Uint8Array): Promise<{ ok: true; url: string } | { ok: false; error: "too_large" | "not_an_image" }> {
    if (bytes.length > MAX_IMAGE_BYTES) return { ok: false, error: "too_large" };
    const kind = sniffImage(bytes);
    if (!kind) return { ok: false, error: "not_an_image" };
    const id = `${randomBytes(16).toString("hex")}.${kind.ext}`;
    await this.images.put(imageKey(id), bytes, kind.contentType);
    shop_log.info({ msg: "shop_image_uploaded", website_id: websiteId, bytes: bytes.length });
    return { ok: true, url: `${this.publicUrl}/i/${id}` };
  }

  /** A photo for the shop host's /i/<id>. Ids are random, so knowing one is the only way to fetch it. */
  async image(id: string): Promise<{ body: Uint8Array; contentType: string } | null> {
    if (!IMAGE_ID.test(id)) return null;
    const got = await this.images.get(imageKey(id));
    return got ? { body: got.body, contentType: got.contentType ?? "application/octet-stream" } : null;
  }

  // ── Public reads ─────────────────────────────────────────────────────────

  async publicStore(slug: string): Promise<{ store: Store; pages: Page[] } | null> {
    const store = await this.repo.storeBySlug(slug);
    if (!store) return null;
    return { store: publicStore(store), pages: await this.repo.listPages(store.websiteId, store.slug, true) };
  }

  async publicPage(storeSlug: string, pageSlug: string): Promise<{ store: Store; page: Page } | null> {
    const store = await this.repo.storeBySlug(storeSlug);
    if (!store) return null;
    const page = await this.repo.pageBySlug(store.websiteId, store.slug, pageSlug);
    return page && page.status === "published" ? { store: publicStore(store), page } : null;
  }
}
