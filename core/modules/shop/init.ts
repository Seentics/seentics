import type { AppConfig } from "../../config";
import { getBytes, putBytes } from "../../platform/storage/s3";
import type { CredentialSealer, OrderPurchaseSink, SessionPresence, ShopModule, ShopWebsites } from "./interfaces";
import { createShopPublicRoutes } from "./public-routes";
import { OrderRepository } from "./repositories/order.repository";
import { ShopRepository } from "./repositories/shop.repository";
import { createShopRoutes } from "./routes";
import { OrderService } from "./services/order.service";
import { StoreService, type ImageStore } from "./services/store.service";

/**
 * Build the shop module (docs/shop.md).
 *
 * Its peers arrive as ports: the websites a store is backed by, the integrations module's
 * verified-purchase outbox and key, and recordings' "was this session recorded". No lifecycle:
 * services and routes only.
 */
export function initShopModule(deps: {
  cfg: AppConfig;
  websites: ShopWebsites;
  purchases: OrderPurchaseSink;
  sealer: CredentialSealer | null;
  sessions: SessionPresence;
  images?: ImageStore;
}): ShopModule {
  const { cfg } = deps;
  const images: ImageStore = deps.images ?? {
    put: (key, body, contentType) => putBytes(cfg.shop.bucket, key, body, contentType),
    get: (key) => getBytes(cfg.shop.bucket, key),
  };
  const shops = new ShopRepository(cfg.shop.publicUrl);
  const stores = new StoreService(shops, deps.websites, images, deps.sealer, cfg.shop.host, cfg.shop.publicUrl);
  const orders = new OrderService(shops, new OrderRepository(), deps.purchases, deps.sessions, (store) => stores.steadfastKeys(store));
  return {
    routes: createShopRoutes({ stores, orders, websites: deps.websites }),
    publicRoutes: createShopPublicRoutes({ stores, orders, cfg, render: { trackerScriptUrl: cfg.trackerScriptUrl } }),
  };
}
