import type { AutomationRepository, AutomationRow, AutomationTrackerSettings } from "../interfaces";
import { redactDefinition } from "../lib/popup-rewards";

/** Active automation definitions used by anonymous tracker initialization. */
export class TrackerAutomationSettingsService implements AutomationTrackerSettings {
  constructor(private readonly repository: AutomationRepository) {}

  /**
   * Redacted: the definitions go to every visitor's browser, and coupon codes must not
   * (see `redactRewards`). The dashboard reads the full definition through the CRUD port.
   */
  async activeFor(websiteId: string): Promise<AutomationRow[]> {
    const rows = await this.repository.listActive(websiteId);
    return rows.map((row) => ({ ...row, definition: redactDefinition(row.definition) }));
  }
}
