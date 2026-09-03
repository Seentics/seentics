import type { Context } from "hono";
import { z, type ZodError, type ZodTypeAny } from "zod";

export type ValidationFailShape = {
  error: "validation_error";
  message: string;
  issues?: { path: (string | number)[]; message: string }[];
};

function toIssueList(err: ZodError) {
  return err.issues.map((i) => ({ path: i.path, message: i.message }));
}

export function validationErrorResponse(
  c: Pick<Context, "json">,
  err: ZodError | string,
  status: 400 | 401 | 403 | 404 = 400,
) {
  if (typeof err === "string") {
    const body: ValidationFailShape = { error: "validation_error", message: err };
    return c.json(body, status);
  }
  const body: ValidationFailShape = {
    error: "validation_error",
    message: "Invalid request",
    issues: toIssueList(err),
  };
  return c.json(body, status);
}

export async function parseJson<T extends ZodTypeAny>(
  c: Pick<Context, "req" | "json">,
  schema: T,
): Promise<{ ok: true; data: z.infer<T> } | { ok: false; res: Response }> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return { ok: false, res: validationErrorResponse(c, "Invalid JSON body") };
  }
  const out = schema.safeParse(raw);
  if (!out.success) return { ok: false, res: validationErrorResponse(c, out.error) };
  return { ok: true, data: out.data };
}

export function parseQuery<T extends ZodTypeAny>(
  c: Pick<Context, "req" | "json">,
  schema: T,
): { ok: true; data: z.infer<T> } | { ok: false; res: Response } {
  const u = new URL(c.req.url);
  const q = Object.fromEntries(u.searchParams.entries());
  const out = schema.safeParse(q);
  if (!out.success) return { ok: false, res: validationErrorResponse(c, out.error) };
  return { ok: true, data: out.data };
}

// ---- Shared schema helpers (sanitization/constraints) ----

export const zNonEmptyString = z.string().trim().min(1);

export const zEmail = zNonEmptyString.email().max(320);

export const zUrl = zNonEmptyString.url().max(2048);

export const zUuid = zNonEmptyString.uuid();

/**
 * A bounded integer arriving as a query-string value.
 *
 * The coercion has to wrap the optional/default handling rather than sit inside it.
 * `.optional().default()` inspects the *raw* input, so with the preprocessor on the
 * inside an empty `?limit=` was still "a string" at that point and never reached the
 * default — the endpoint answered 400 for a parameter the client had simply left
 * blank. Normalising blank to `undefined` first is what makes "unspecified" and
 * "absent" the same request.
 *
 * Omitting `defaultValue` yields an optional schema rather than a required one: every
 * caller of that form is a query parameter that may legitimately be absent, and a
 * required variant could not express "blank means unset" at all.
 */
export function zBoundedInt(opts: {
  min: number;
  max: number;
  defaultValue: number;
}): z.ZodType<number, z.ZodTypeDef, unknown>;
export function zBoundedInt(opts: {
  min: number;
  max: number;
  defaultValue?: undefined;
}): z.ZodType<number | undefined, z.ZodTypeDef, unknown>;
// The overloads exist so the two branches below do not collapse into one union return
// type. Without them the defaulted form infers `number | undefined`, and every handler
// that reads a defaulted query parameter has to re-narrow a value that can never be
// absent.
export function zBoundedInt(opts: {
  min: number;
  max: number;
  defaultValue?: number;
}): z.ZodType<number | undefined, z.ZodTypeDef, unknown> {
  const bounded = z.number().int().min(opts.min).max(opts.max);

  /** Blank means "unspecified", so it normalises to `undefined` rather than NaN. */
  const coerce = (v: unknown): unknown => {
    if (typeof v === "string") {
      const trimmed = v.trim();
      return trimmed === "" ? undefined : Number(trimmed);
    }
    return v;
  };

  if (opts.defaultValue == null) return z.preprocess(coerce, bounded.optional());

  // The default is substituted inside the preprocessor rather than by chaining
  // `.optional().default()` on the outside. Chaining put the default *above* the
  // coercion, so a blank `?limit=` was still a string when the default was evaluated
  // and fell through to the number check as a 400. Doing it here also keeps the inner
  // schema a plain required number, so the inferred output stays `number`.
  const withDefault = opts.defaultValue;
  return z.preprocess((v) => coerce(v) ?? withDefault, bounded);
}

