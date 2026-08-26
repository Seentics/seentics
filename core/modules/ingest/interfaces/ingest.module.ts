import type { PublicRouter } from "../../../platform/http/router";
import type { ModuleLifecycle } from "../../../app/module";
import type { IngestSinks } from "./index";

/** Everything the ingest module offers. */
export interface IngestModule extends ModuleLifecycle {
  /**
   * Where the four downstream modules' data goes.
   *
   * Exposed because the `/internal` collectors write to the same four targets as
   * `/collect` does; without this they would need their own wiring to the same places.
   */
  sinks: IngestSinks;

  /** No auth context: the tracker is anonymous by design. */
  routes: PublicRouter;
}
