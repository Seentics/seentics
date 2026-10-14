import { Hono } from "hono";
import { authMiddleware, requireUser, type AuthVars } from "../../platform/middleware/auth";
import {
  askAgent,
  confirmProposal,
  getConversation,
  listConversations,
} from "./controllers/ai-agent.controller";
import type { AiControllerDeps } from "./controllers/ai-controller.types";
import { getAiHistory } from "./controllers/ai-history.controller";
import { queryAi } from "./controllers/ai-query.controller";
import { getInsight, refreshInsight } from "./insights/controller";
import { getAlertSettings, listAlerts, putAlertSettings } from "./anomalies/controller";
import {
  dismissRecommendation,
  getRecommendation,
  listRecommendations,
  markRecommendationDone,
} from "./recommendations/controller";

export function createAiRoutes(deps: AiControllerDeps) {
  const routes = new Hono<{ Variables: AuthVars }>();
  routes.use("*", authMiddleware);

  // Whether a model is configured at all, so the web app can decide to lead with AI. Not
  // website-scoped: it says nothing about any site, only about this deployment.
  routes.get("/status", (c) =>
    requireUser(c) ? c.json({ data: { configured: deps.configured } }) : c.json({ error: "unauthorized" }, 401),
  );

  // The conversational assistant.
  routes.post("/chat/:website_id", askAgent(deps));
  routes.get("/conversations/:website_id", listConversations(deps));
  routes.get("/conversation/:website_id/:conversation_id", getConversation(deps));
  // Applying a draft is a POST because it creates; the id in the path is the query that
  // produced the draft, not the resource it will create.
  routes.post("/confirm/:website_id/:query_id", confirmProposal(deps));

  // The single-shot SQL path, still the right tool for a question no typed read covers.
  routes.post("/query/:website_id", queryAi(deps));
  routes.get("/history/:website_id", getAiHistory(deps));

  // The daily insight lines at the top of the dashboard: stored, so reading one is free.
  routes.get("/insights/:website_id", getInsight(deps));
  routes.post("/insights/:website_id/refresh", refreshInsight(deps));

  // Anomaly alerts: what the hourly check found, and each site's alert settings. Stored rows only.
  // Without the anomaly service (tests that do not need it) the routes are simply absent.
  if (deps.alerts) {
    const alertDeps = { alerts: deps.alerts, websites: deps.websites };
    routes.get("/alerts/:website_id", listAlerts(alertDeps));
    routes.get("/alerts/:website_id/settings", getAlertSettings(alertDeps));
    routes.put("/alerts/:website_id/settings", putAlertSettings(alertDeps));
  }

  // Recommendations and their impact reports. Stored rows only: reading never calls a model, and
  // they show without one (most come from rules). Absent where the service is not wired.
  if (deps.recommendations) {
    const recDeps = { recommendations: deps.recommendations, websites: deps.websites };
    routes.get("/recommendations/:website_id", listRecommendations(recDeps));
    routes.get("/recommendations/:website_id/:id", getRecommendation(recDeps));
    routes.post("/recommendations/:website_id/:id/dismiss", dismissRecommendation(recDeps));
    routes.post("/recommendations/:website_id/:id/done", markRecommendationDone(recDeps));
  }
  return routes;
}
