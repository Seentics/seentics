import type { AutomationRow } from "./automation.interface";

/**
 * What the tracker needs to know about a website's automations.
 *
 * Separate from `AutomationCrud` for the same reason `WebsiteQuery` is separate
 * from `WebsiteMutations`: the caller is the anonymous tracker init
 * endpoint, it runs on every first page view of every session, and it needs
 * exactly one read. Handing that path an interface with `delete` on it would be
 * the widest unauthenticated surface in the module.
 */
export interface AutomationTrackerSettings {
  /**
   * Active automations for a website, so the tracker can evaluate client-side
   * triggers without a round trip per rule.
   *
   * Returns whole rows because the tracker payload spreads `definition` and the
   * shape of a definition is open-ended by design. Inactive automations are
   * filtered out here rather than client-side — an inactive automation's
   * definition is not something a visitor's browser should receive.
   */
  activeFor(websiteRef: string): Promise<AutomationRow[]>;
}
