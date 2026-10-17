import type { EmbedLinks } from "../../api-keys/interfaces";
import { ClientOperationError, type ClientDirectory, type OwnedWebsites } from "../../websites/interfaces";
import {
  AgencyOperationError,
  type AgencyOverviewReader,
  type AgencySetup,
  type WebsiteVerification,
  type WhiteLabel,
} from "../interfaces";
import { decodeCursor } from "../lib/cursor";
import { fail, notFound, validationFailed } from "../lib/envelope";
import type { AgencyCtx } from "../lib/gateway-context";
import { idSchema } from "../validators/agency.schema";

/** Everything the agency API's handlers use, each through its narrowest interface. */
export type AgencyControllerDeps = {
  clients: ClientDirectory;
  websites: OwnedWebsites;
  whiteLabel: WhiteLabel;
  overview: AgencyOverviewReader;
  setup: AgencySetup;
  verification: WebsiteVerification;
  embedLinks: EmbedLinks;
  /** Read per request, so the snippet and docs links follow config. */
  urls: () => { scriptUrl: string; frontendUrl: string };
};

/** Postgres: a value that cannot be the column's type — an id that is not a UUID. */
const BAD_INPUT_CODES = new Set(["22P02", "22007"]);

/**
 * Run a handler as the agency the gateway named, and answer a refused operation with its
 * envelope error rather than a 500.
 */
export function handle(run: (c: AgencyCtx, ownerId: string) => Promise<Response>) {
  return async (c: AgencyCtx) => {
    try {
      return await run(c, c.get("agency").ownerId);
    } catch (e) {
      if (e instanceof ClientOperationError) return notFound(c, e.reason === "website_not_found" ? "Website" : "Client");
      if (e instanceof AgencyOperationError) return fail(c, 409, "conflict", "That slug is taken by another agency.");
      const code = (e as { code?: unknown })?.code;
      if (typeof code === "string" && BAD_INPUT_CODES.has(code)) return notFound(c);
      throw e;
    }
  };
}

/** A path id, or `null` for one that is not a UUID — which, like a foreign id, is just not found. */
export function idParam(c: AgencyCtx, name: string): string | null {
  const parsed = idSchema.safeParse(c.req.param(name));
  return parsed.success ? parsed.data.toLowerCase() : null;
}

/** `?cursor=` decoded, or the 422 for one this API never issued. */
export function cursorOf(c: AgencyCtx, cursor: string | undefined) {
  if (cursor === undefined) return { ok: true as const, after: undefined };
  const after = decodeCursor(cursor);
  return after ? { ok: true as const, after } : { ok: false as const, res: validationFailed(c, "cursor is not valid") };
}
