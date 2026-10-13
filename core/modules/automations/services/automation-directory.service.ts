import { sql } from "../../../db";
import type { AutomationDirectory } from "../interfaces";

export class AutomationDirectoryService implements AutomationDirectory {
  async names(websiteId: string, ids: readonly string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const rows = await sql<{ id: string; name: string }[]>`
      SELECT id, name FROM automations
      WHERE website_id = ${websiteId}::uuid AND id = ANY(${ids as string[]}::uuid[])
    `;
    return new Map(rows.map((r) => [r.id, r.name]));
  }
}
