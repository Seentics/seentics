import type { Context } from "hono";
import { env } from "../../../config";
import { originFromRequest, validateOriginDomain } from "../../../platform/http/origin";
import type { TrackerControllerDeps } from "./tracker-controller.types";

/**
 * `GET /snapshot-needed/:website_id?path=…&page_key=…` → `{ needed }`.
 *
 * The tracker asks this before capturing a page's layout, and captures only on `true` —
 * see `HeatmapSnapshotDemandService` for why. Every refusal is `needed: false` rather than
 * an error status: the only thing the tracker does with the answer is decide whether to
 * do work, and a site that is unknown, inactive, off-domain or has layout capture off
 * should get none done.
 *
 * `private`: the answer is one visitor's claim on a page, so a shared cache must not
 * hand it to the next visitor, and it depends on the User-Agent the URL does not carry.
 */
export function snapshotNeeded(deps: TrackerControllerDeps) {
  return async (c: Context) => {
    c.header("Cache-Control", "private, no-store");
    const no = () => c.json({ needed: false });

    const websiteRef = c.req.param("website_id")?.trim() ?? "";
    const path = (c.req.query("path") ?? "").trim();
    if (!websiteRef || !path || path.length > 2048) return no();
    const pageKey = (c.req.query("page_key") ?? "").trim() || undefined;

    const website = await deps.trackerWebsites.resolve(websiteRef);
    if (!website || !website.is_active || !website.heatmap_enabled || !website.heatmap_layout_enabled) {
      return no();
    }
    const origin = originFromRequest(c.req.raw.headers);
    if (!validateOriginDomain(origin, website.url, env().environment)) return no();

    const needed = await deps.snapshotDemand.snapshotNeeded(
      website.id,
      path,
      pageKey,
      c.req.header("user-agent") ?? "",
    );
    return c.json({ needed });
  };
}
