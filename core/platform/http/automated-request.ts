import type { Context } from "hono";
import { env } from "../../config";
import { isBotUserAgent } from "./bot-user-agent";
import { clientIpForIngest } from "./client-ip";
import { isCrawlerNetwork } from "./crawler-network";

/**
 * Whether a tracker request comes from a crawler rather than a person: one that says so in its
 * User-Agent, or one from a network only crawlers browse from (Meta's link checker, which says
 * it is mobile Chrome). Nothing a crawler sends is stored, counted or acted on.
 */
export function isAutomatedRequest(c: Context): boolean {
  const cfg = env();
  if (isBotUserAgent(c.req.header("user-agent"), { production: cfg.isProduction })) return true;
  return isCrawlerNetwork(clientIpForIngest(c, cfg.trustProxy, cfg.isProduction));
}
