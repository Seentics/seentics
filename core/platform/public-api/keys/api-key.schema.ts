import { z } from "zod";
import { zNonEmptyString } from "../../validation";
import { API_SCOPES } from "./scopes";

/**
 * Creating a key.
 *
 * At least one scope is required. A key with none is treated as unrestricted by the
 * middleware — that leniency exists for keys minted before scoping, and letting the form
 * produce one would turn a compatibility allowance into the default.
 */
export const apiKeyCreateSchema = z.object({
  name: zNonEmptyString.max(80),
  scopes: z
    .array(z.enum(API_SCOPES))
    .min(1, "Choose at least one scope.")
    .max(API_SCOPES.length)
    // A repeated scope is harmless but makes the stored list misleading.
    .transform((s) => [...new Set(s)]),
});
