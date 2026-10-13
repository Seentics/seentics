import type { AppConfig } from "../../config";
import { log } from "../../platform/observability/logger";
import type { LeadCapture } from "../leads/interfaces";
import type { WebsitesModule } from "../websites/interfaces";
import type { IntegrationsModule } from "./interfaces";
import { createProviderContext } from "./lib/http";
import { resolveVault } from "./lib/vault";
import { countConnections } from "./repositories/integration.repository";
import { createIntegrationRoutes } from "./routes";
import { ConnectionService } from "./services/connection.service";
import { DeliveryService } from "./services/delivery.service";
import { IntegrationsRetentionPurge } from "./services/retention-purge.service";

/**
 * Build the integrations module.
 *
 * Composition is side-effect free: the subscription to captured leads happens in `start`,
 * which also checks the encryption key — a production deployment holding connections but no
 * key logs an error at boot rather than failing quietly on the first lead.
 */
export function initIntegrationsModule(deps: {
  websitesModule: WebsitesModule;
  leads: Pick<LeadCapture, "onCaptured">;
  cfg: AppConfig;
}): IntegrationsModule {
  const vault = resolveVault(deps.cfg);
  const ctx = createProviderContext();
  const connections = new ConnectionService(vault, ctx);
  const delivery = new DeliveryService(vault, ctx);
  let unsubscribe: (() => void) | null = null;

  return {
    queries: connections,
    mutations: connections,
    retention: new IntegrationsRetentionPurge(),
    routes: createIntegrationRoutes({ queries: connections, mutations: connections, websites: deps.websitesModule.accessChecks }),

    async start() {
      if (vault.vault === null) {
        const existing = await countConnections().catch(() => 0);
        if (existing > 0) log.error({ msg: "integrations_key_missing", connections: existing, note: vault.reason });
      } else if (vault.ephemeralDevKey) {
        log.warn({ msg: "integrations_dev_key", note: "using the built-in development key; set INTEGRATIONS_ENCRYPTION_KEY before storing real credentials" });
      }
      unsubscribe = deps.leads.onCaptured((lead) => delivery.handle(lead));
    },

    async stop() {
      unsubscribe?.();
      unsubscribe = null;
      // Let leads already captured finish reaching their destinations before the process exits.
      await delivery.drain();
    },
  };
}
