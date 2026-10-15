import { Hono } from "hono";
import { authMiddleware, type AuthVars } from "../../platform/middleware/auth";
import type { FunnelControllerDeps } from "./controllers/funnel-controller.types";
import {
  bulkDeleteFunnels,
  createFunnel,
  deleteFunnel,
  getFunnel,
  listFunnels,
  updateFunnel,
} from "./controllers/funnel-crud.controller";
import { getFunnelReport, getFunnelReports } from "./controllers/funnel-report.controller";
import { getActiveFunnels } from "./controllers/funnel-tracker.controller";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function createFunnelRoutes(deps: FunnelControllerDeps) {
  const publicRoutes = new Hono<{ Variables: AuthVars }>();
  publicRoutes.get("/active", getActiveFunnels(deps));

  const authRoutes = new Hono<{ Variables: AuthVars }>();
  authRoutes.use("*", authMiddleware);
  authRoutes.get("/:website_id/funnels", listFunnels(deps));
  authRoutes.post("/:website_id/funnels", createFunnel(deps));
  authRoutes.delete("/:website_id/funnels/bulk-delete", bulkDeleteFunnels(deps));
  authRoutes.get("/:website_id/funnels/stats", getFunnelReports(deps));
  // An id that is not a uuid names no funnel. It used to reach the uuid column and come
  // back as a 500 from the database error.
  for (const path of ["/:website_id/funnels/:funnel_id", "/:website_id/funnels/:funnel_id/stats"]) {
    authRoutes.use(path, async (c, next) => {
      const id = c.req.param("funnel_id") ?? "";
      if (id === "bulk-delete" || id === "stats" || UUID.test(id)) return next();
      return c.json({ error: "not found" }, 404);
    });
  }
  authRoutes.get("/:website_id/funnels/:funnel_id", getFunnel(deps));
  authRoutes.put("/:website_id/funnels/:funnel_id", updateFunnel(deps));
  authRoutes.delete("/:website_id/funnels/:funnel_id", deleteFunnel(deps));
  authRoutes.get("/:website_id/funnels/:funnel_id/stats", getFunnelReport(deps));
  return { publicRoutes, authRoutes };
}
