import type { Context } from "hono";

/** Minimal context for reading JSON (avoids inline structural types on helpers). */
export type JsonRequestContext = Pick<Context, "req">;
