import type {
  CreateFunnelInput,
  Funnel,
  FunnelMutations,
  FunnelQuery,
  UpdateFunnelInput,
} from "../interfaces";
import {
  deleteFunnel,
  deleteFunnels,
  findFunnel,
  insertFunnel,
  listFunnels,
  updateFunnel,
} from "../repositories/funnel.repository";
import { FunnelValidationError, validateFunnelDefinition } from "../lib/funnel-validation";

/** CRUD for funnel definitions. The controller supplies an authorized website id. */
export class FunnelDefinitionService implements FunnelQuery, FunnelMutations {
  /** `isValidPattern` asks the database whether a regular expression is one it can run. */
  constructor(private readonly isValidPattern: (pattern: string) => Promise<boolean> = async () => true) {}

  private async check(input: { steps?: Record<string, unknown>[] | undefined; conversion_window_hours?: unknown }) {
    const issues = await validateFunnelDefinition(input, this.isValidPattern);
    if (issues.length) throw new FunnelValidationError(issues);
  }

  list(websiteId: string): Promise<Funnel[]> {
    return listFunnels(websiteId);
  }

  get(websiteId: string, funnelId: string): Promise<Funnel | null> {
    return findFunnel(websiteId, funnelId);
  }

  async create(websiteId: string, userId: string, input: CreateFunnelInput): Promise<Funnel> {
    await this.check(input);
    return insertFunnel(websiteId, userId, input);
  }

  async update(
    websiteId: string,
    funnelId: string,
    input: UpdateFunnelInput,
  ): Promise<Funnel | null> {
    await this.check(input);
    return updateFunnel(websiteId, funnelId, input);
  }

  async remove(websiteId: string, funnelId: string): Promise<void> {
    await deleteFunnel(websiteId, funnelId);
  }

  async bulkRemove(websiteId: string, funnelIds: string[]): Promise<void> {
    if (funnelIds.length === 0) return;
    await deleteFunnels(websiteId, funnelIds);
  }
}
