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

export function parseParams<T extends ZodTypeAny>(
  c: Pick<Context, "req" | "json">,
  schema: T,
): { ok: true; data: z.infer<T> } | { ok: false; res: Response } {
  // Hono supports `c.req.param()` returning all params (Bun runtime).
  const raw = (c.req as unknown as { param: () => Record<string, string> }).param();
  const out = schema.safeParse(raw);
  if (!out.success) return { ok: false, res: validationErrorResponse(c, out.error) };
  return { ok: true, data: out.data };
}

// ---- Shared schema helpers (sanitization/constraints) ----

export const zTrimmed = z.string().trim();

export const zNonEmptyString = z.string().trim().min(1);

export const zEmail = zNonEmptyString.email().max(320);

export const zUrl = zNonEmptyString.url().max(2048);

export const zUuid = zNonEmptyString.uuid();

export function zBoundedInt(opts: { min: number; max: number; defaultValue?: number }) {
  const base = z.preprocess((v) => {
    if (typeof v === "number") return v;
    if (typeof v === "string" && v.trim() !== "") return Number(v);
    return v;
  }, z.number().int().min(opts.min).max(opts.max));
  return opts.defaultValue == null ? base : base.optional().default(opts.defaultValue);
}

