import { z } from "zod";
import { zNonEmptyString, zUrl } from "../../../platform/validation";

export const websiteCreateSchema = z.object({
  name: zNonEmptyString.max(120),
  url: zUrl,
});

export const websitePatchSchema = z.record(z.unknown());

export const goalCreateSchema = z.object({
  name: zNonEmptyString.max(120),
  type: zNonEmptyString.max(64),
  identifier: zNonEmptyString.max(256),
  selector: z.string().trim().max(1024).optional(),
});

export const goalPatchSchema = z.record(z.unknown());

export const memberAddSchema = z.object({
  email: zNonEmptyString.email().max(320),
  role: z.string().trim().max(32).optional(),
});

export const memberRoleSchema = z.object({
  role: zNonEmptyString.max(32),
});
