import { Hono } from "hono";
import { authMiddleware, type AuthVars } from "../../platform/middleware/auth";
import {
  askAgent,
  confirmProposal,
  getConversation,
  listConversations,
} from "./controllers/ai-agent.controller";
import type { AiControllerDeps } from "./controllers/ai-controller.types";
import { getAiHistory } from "./controllers/ai-history.controller";
import { queryAi } from "./controllers/ai-query.controller";

export function createAiRoutes(deps: AiControllerDeps) {
  const routes = new Hono<{ Variables: AuthVars }>();
  routes.use("*", authMiddleware);

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
  return routes;
}
