/**
 * Public contracts for the funnels module.
 *
 * Peer modules should import from here and from nowhere deeper — the repositories
 * are internal, and reaching past this barrier is how the resolve-once rule in
 * `FunnelService` gets bypassed.
 */
export type {
  CreateFunnelInput,
  Funnel,
  FunnelMutations,
  FunnelPerformance,
  FunnelQuery,
  FunnelReport,
  FunnelStep,
  FunnelTrackerConfig,
  UpdateFunnelInput,
} from "./funnel.interface";

export { TRACKER_FUNNEL_EVENT_TYPES } from "./funnel.interface";
