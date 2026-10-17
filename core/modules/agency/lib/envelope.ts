import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import type { ZodError, ZodType, ZodTypeDef } from "zod";

/**
 * The agency API's envelope, shared with the gateway and the web client:
 *
 *   success  { data }
 *   list     { data: [...], page: { next_cursor, has_more } }
 *   error    { error: { code, message, details?, request_id } }
 *
 * Every response from `/api/v1/agency` goes through one of these, so the shape is decided
 * here and nowhere else.
 */

export const ERROR_CODES = ["unauthorized", "forbidden", "not_found", "validation_failed", "conflict"] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

const requestIdOf = (c: Context): string => (c.get("requestId" as never) as string | undefined) ?? "";

export function ok<T>(c: Context, data: T, status: ContentfulStatusCode = 200): Response {
  return c.json({ data }, status);
}

export function list<T>(c: Context, data: T[], page: { nextCursor: string | null; hasMore: boolean }): Response {
  return c.json({ data, page: { next_cursor: page.nextCursor, has_more: page.hasMore } });
}

export function fail(c: Context, status: ContentfulStatusCode, code: ErrorCode, message: string, details?: unknown): Response {
  return c.json({ error: { code, message, ...(details === undefined ? {} : { details }), request_id: requestIdOf(c) } }, status);
}

export const notFound = (c: Context, what = "Resource") => fail(c, 404, "not_found", `${what} not found.`);

/** Zod issues as `details`: where each problem is, and what it is. */
export function validationFailed(c: Context, error: ZodError | string): Response {
  if (typeof error === "string") return fail(c, 422, "validation_failed", error);
  const issues = error.issues.map((i) => ({ path: i.path.join("."), message: i.message }));
  return fail(c, 422, "validation_failed", issues[0] ? `${issues[0].path || "body"}: ${issues[0].message}` : "Invalid request.", { issues });
}

type Parsed<T> = { ok: true; data: T } | { ok: false; res: Response };

export async function parseBody<T>(c: Context, schema: ZodType<T, ZodTypeDef, unknown>): Promise<Parsed<T>> {
  const text = await c.req.text();
  let json: unknown = {};
  if (text.trim()) {
    try {
      json = JSON.parse(text);
    } catch {
      return { ok: false, res: validationFailed(c, "Request body is not valid JSON.") };
    }
  }
  const parsed = schema.safeParse(json);
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, res: validationFailed(c, parsed.error) };
}

export function parseQuery<T>(c: Context, schema: ZodType<T, ZodTypeDef, unknown>): Parsed<T> {
  const parsed = schema.safeParse(c.req.query());
  return parsed.success ? { ok: true, data: parsed.data } : { ok: false, res: validationFailed(c, parsed.error) };
}
