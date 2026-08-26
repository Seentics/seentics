import type { Hono } from "hono";
import type { AuthVars } from "../middleware/auth";

/**
 * Router shapes, so a module's public interface can name its HTTP surface without
 * importing its own `routes.ts`.
 *
 * That import would be legal — same module — but it would drag every route handler's
 * types into the one file peers are supposed to be able to read on its own. These two
 * aliases keep a module interface to declarations.
 */

/** A router behind `authMiddleware`; handlers can read the resolved user. */
export type AuthedRouter = Hono<{ Variables: AuthVars }>;

/** A router with no auth context — the tracker and internal collectors. */
export type PublicRouter = Hono;
