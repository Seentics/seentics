import type { WebsiteQuery } from "../../websites/interfaces";
import type { AiAccessCheck, AiQuery, AIDomain, AIHistoryItem, AIQueryResult } from "../interfaces";
import { getAIQueryHistory, runAIQuery } from "./ai-query.service";

/**
 * The ai module's facade.
 *
 * Two things changed by introducing it. Resolution now happens once per call through
 * the injected `WebsiteQuery` port, where it previously went through
 * `platform/lib/website-resolve` inside each function — a read of the websites table
 * from a module that does not own it. And the access check is the websites module's
 * `getRole` rather than a hand-rolled owner-or-member query that reproduced it.
 */
export class AiService implements AiQuery, AiAccessCheck {
  constructor(private readonly websites: WebsiteQuery) {}

  /**
   * Resolve a website reference to both identifiers.
   *
   * `null` when unknown. Callers turn that into an empty result rather than an
   * error: the routes check access first, so an unresolvable reference here means
   * the website disappeared between the guard and the call.
   */
  private async resolve(
    websiteRef: string,
  ): Promise<{ siteId: string; uuid: string } | null> {
    const website = await this.websites.getById(websiteRef);
    if (!website) return null;
    return { siteId: website.siteId, uuid: website.id };
  }

  async runQuery(
    userId: string,
    websiteRef: string,
    prompt: string,
    domain: AIDomain | "auto" = "auto",
  ): Promise<AIQueryResult> {
    const resolved = await this.resolve(websiteRef);
    // Thrown rather than returned empty: a query is a billable LLM call, and
    // silently answering "no data" for a website that does not exist would spend
    // the user's daily quota on nothing.
    if (!resolved) throw new Error("website not found");
    return runAIQuery(userId, resolved, prompt, domain);
  }

  async getHistory(userId: string, websiteRef: string, limit = 8): Promise<AIHistoryItem[]> {
    const resolved = await this.resolve(websiteRef);
    if (!resolved) return [];
    return getAIQueryHistory(userId, resolved, limit);
  }

  /**
   * Whether the user may query this website.
   *
   * Owner and member both qualify, which is what the previous hand-rolled check
   * did — `getRole` returning anything non-null is the same predicate.
   */
  async userCanQuery(websiteRef: string, userId: string): Promise<boolean> {
    return (await this.websites.getRole(websiteRef, userId)) !== null;
  }
}
