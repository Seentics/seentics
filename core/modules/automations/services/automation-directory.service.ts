import { sql } from "../../../db";
import type { AutomationDirectory, AutomationRepository, PopupRewards } from "../interfaces";
import { rewardsOfDefinition } from "../lib/popup-rewards";

export class AutomationDirectoryService implements AutomationDirectory {
  constructor(private readonly repository: AutomationRepository) {}

  async names(websiteId: string, ids: readonly string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const rows = await sql<{ id: string; name: string }[]>`
      SELECT id, name FROM automations
      WHERE website_id = ${websiteId}::uuid AND id = ANY(${ids as string[]}::uuid[])
    `;
    return new Map(rows.map((r) => [r.id, r.name]));
  }

  async rewards(websiteId: string, automationId: string): Promise<PopupRewards | null> {
    const automation = await this.repository.findById(websiteId, automationId);
    return automation ? rewardsOfDefinition(automation.definition) : null;
  }
}
