import { analyticsRead } from "./analytics-access";
import type { AnalyticsControllerDeps } from "./analytics-controller.types";

export const getLiveVisitors = (deps: AnalyticsControllerDeps) =>
  analyticsRead(deps, (websiteRef) => deps.realtime.getLiveVisitors(websiteRef));
