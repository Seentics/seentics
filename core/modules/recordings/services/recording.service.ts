import type { EventBus } from "../../../infrastructure/events";
import type { WebsiteQuery } from "../../websites/interfaces";
import type {
  RecordingMutations,
  RecordingQuery,
  RecordingSummary,
  SessionListFilters,
  SessionListSummary,
} from "../interfaces";
import { batchDeleteReplaySessions } from "./session-delete.service";
import { getReplaySessionDetail, type ReplaySessionDetail } from "./session-detail.service";
import { listReplaySessions } from "./session-list.service";

/**
 * Resolved identifiers for a website.
 *
 * Recording rows are keyed by whichever identifier the tracker happened to send,
 * so every query has to match on both — see `listSessions` in the repository.
 */
/**
 * The recordings read/write facade.
 *
 * Its structural job mirrors `AnalyticsQueryService`: resolve a website reference
 * once, through the injected `WebsiteQuery` port, and hand resolved identifiers to
 * the services underneath. Those services each called `resolveWebsiteIdsLenient`
 * themselves, which meant the recordings module read the `websites` table directly
 * and re-resolved on every call.
 */
export class RecordingService implements RecordingQuery, RecordingMutations {
  constructor(
    private readonly websites: WebsiteQuery,
    private readonly eventBus: EventBus,
  ) {}

  /**
   * Resolve a website reference, tolerating an unknown one.
   *
   * Falls back to using the reference as both identifiers rather than throwing,
   * preserving the `lenientResolve` behaviour these endpoints already had. That
   * matters because recordings can be written under an identifier whose website
   * row was since deleted; failing the lookup would hide rows the user can still
   * legitimately list and delete, leaving them unable to clean up.
   *
   * Access is checked by the route before this runs, so a bogus reference here
   * yields an empty result rather than exposing anything.
   */
  /**
   * The website's id, or the reference itself when the website is unknown.
   *
   * Lenient on purpose: `session_replays` rows outlive the website row they belong to
   * until retention sweeps them, and refusing to list them would hide data the user can
   * still legitimately see. This used to return a pair, because the table could have
   * been keyed by either identifier.
   */
  private async resolve(websiteRef: string): Promise<string> {
    const website = await this.websites.getById(websiteRef);
    return website?.id ?? websiteRef;
  }

  async listSessions(
    websiteRef: string,
    limit: number,
    offset: number,
    filters: SessionListFilters = {},
  ): Promise<{
    sessions: RecordingSummary[];
    limit: number;
    offset: number;
    total: number;
    summary: SessionListSummary;
  }> {
    const websiteId = await this.resolve(websiteRef);
    return listReplaySessions(websiteId, limit, offset, filters);
  }

  async getSessionDetail(websiteRef: string, sessionId: string): Promise<ReplaySessionDetail> {
    const websiteId = await this.resolve(websiteRef);
    return getReplaySessionDetail(websiteId, sessionId);
  }

  async batchDelete(websiteRef: string, sessionIds: string[]): Promise<void> {
    const websiteId = await this.resolve(websiteRef);
    await batchDeleteReplaySessions(websiteId, sessionIds);
  }
}
