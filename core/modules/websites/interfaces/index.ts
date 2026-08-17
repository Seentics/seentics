/**
 * Public contracts for the websites module.
 *
 * Peer modules should import from here and from nowhere deeper — the service and
 * repository implementations are internal. `WebsiteQuery` is what almost every
 * consumer wants.
 */
export type {
  CreateWebsiteInput,
  UpdateWebsiteInput,
  Website,
  WebsiteIngestionSettings,
  WebsiteMutations,
  WebsitePublicSharing,
  WebsiteQuery,
  WebsiteRole,
  WebsiteSettings,
} from "./website.interface";

export type { WebsiteRepository } from "./website-repository.interface";

export type { TrafficSummary, TrafficSummaryProvider } from "./traffic-summary.interface";
export { emptyTrafficSummary } from "./traffic-summary.interface";
