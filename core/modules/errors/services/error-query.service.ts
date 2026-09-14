import type {
  ErrorGroupSummary,
  ErrorMutations,
  ErrorQueries,
  ErrorSample,
} from "../interfaces";
import {
  getErrorGroup,
  listErrorGroups,
  listErrorSamples,
  setErrorGroupStatus,
} from "../repositories/error-reads.repository";

/**
 * Dashboard reads for the errors module.
 *
 * Takes an already-resolved website id — access is checked by the controller, and these
 * queries scope every statement by it regardless, because a fingerprint is guessable and
 * a read filtered on it alone would cross tenants.
 */
export class ErrorQueryService implements ErrorQueries {
  async listGroups(
    websiteId: string,
    q: { days: number; status?: string; search?: string; limit?: number },
  ): Promise<{ groups: ErrorGroupSummary[] }> {
    return { groups: await listErrorGroups(websiteId, q) };
  }

  /**
   * A group and its recent samples.
   *
   * The samples are fetched only when the group exists. Skipping that check would run a
   * scan for a fingerprint belonging to nobody — the shape a probe takes — and answer
   * with an empty list rather than a 404.
   */
  async getGroup(
    websiteId: string,
    fingerprint: string,
    q: { days: number; limit?: number },
  ): Promise<{ group: ErrorGroupSummary | null; samples: ErrorSample[] }> {
    const group = await getErrorGroup(websiteId, fingerprint);
    if (!group) return { group: null, samples: [] };
    return { group, samples: await listErrorSamples(websiteId, fingerprint, q) };
  }
}

export class ErrorMutationService implements ErrorMutations {
  async setStatus(websiteId: string, fingerprint: string, status: string): Promise<boolean> {
    return setErrorGroupStatus(websiteId, fingerprint, status);
  }
}
