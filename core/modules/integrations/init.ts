import type { AppConfig } from "../../config";
import { log } from "../../platform/observability/logger";
import type { WebsitesModule } from "../websites/interfaces";
import type { IntegrationsModule } from "./interfaces";
import { createProviderContext } from "./lib/http";
import { resolveVault } from "./lib/vault";
import { countConnections } from "./repositories/connection.repository";
import { createIntegrationRoutes } from "./routes";
import { ConnectionService } from "./services/connection.service";
import { DeliveryAttemptService } from "./services/delivery-attempt.service";
import { DeliveryWorker } from "./services/delivery-worker.service";
import { OutboxService } from "./services/outbox.service";
import { IntegrationsRetentionPurge } from "./services/retention-purge.service";
import { ConversionSiteMetrics } from "./services/agency-site-metrics.service";
import { conversionsLane } from "./conversion-lane";
import { createConversionRoutes } from "./conversion-routes";
import { claimDueConversions, type ClaimedConversion } from "./repositories/conversion.repository";
import { ConversionAdminService } from "./services/conversion-admin.service";
import { ConversionAttemptService } from "./services/conversion-attempt.service";
import { ConversionRouter } from "./services/conversion-router.service";

/**
 * Build the integrations module: destinations, and the outbox that delivers to them.
 *
 * Composition is side-effect free: the worker starts in `start`, which also checks the
 * encryption key — a production deployment holding connections but no key logs an error at
 * boot rather than failing quietly on the first lead. The module is composed before leads,
 * which hands it every captured submission through `sink`.
 */
export function initIntegrationsModule(deps: { websitesModule: WebsitesModule; cfg: AppConfig }): IntegrationsModule {
  const vault = resolveVault(deps.cfg);
  const ctx = createProviderContext();
  const connections = new ConnectionService(vault, ctx);
  const worker = new DeliveryWorker(new DeliveryAttemptService(vault, ctx));
  // Server-side conversions: their own outbox and worker, the same rules as a lead's delivery.
  const conversionWorker = new DeliveryWorker<ClaimedConversion>(new ConversionAttemptService(vault, ctx), claimDueConversions);
  const router = new ConversionRouter(() => conversionWorker.kick());
  const conversionAdmin = new ConversionAdminService(vault, ctx, (websiteId) => router.invalidate(websiteId));

  return {
    queries: connections,
    mutations: connections,
    sink: new OutboxService(() => worker.kick(), router),
    conversions: {
      lane: conversionsLane(() => router),
      admin: conversionAdmin,
      routes: createConversionRoutes({ admin: conversionAdmin, websites: deps.websitesModule.accessChecks }),
    },
    retention: new IntegrationsRetentionPurge(),
    agencyMetrics: new ConversionSiteMetrics(),
    routes: createIntegrationRoutes({ queries: connections, mutations: connections, websites: deps.websitesModule.accessChecks }),

    async start() {
      if (vault.vault === null) {
        const existing = await countConnections().catch(() => 0);
        if (existing > 0) log.error({ msg: "integrations_key_missing", connections: existing, note: vault.reason });
      } else if (vault.ephemeralDevKey) {
        log.warn({ msg: "integrations_dev_key", note: "using the built-in development key; set INTEGRATIONS_ENCRYPTION_KEY before storing real credentials" });
      }
      worker.start();
      conversionWorker.start();
    },

    async stop() {
      // Let attempts already running finish before the process exits; whatever is still
      // pending stays in the table for the next process.
      await Promise.all([worker.stop(), conversionWorker.stop()]);
    },
  };
}
