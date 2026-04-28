import { z } from "zod";
import { zEmail, zNonEmptyString } from "./validation";

export const authRegisterSchema = z.object({
  email: zEmail,
  password: zNonEmptyString.min(8).max(256),
  name: z.string().trim().max(120).optional().default(""),
});

export const authLoginSchema = z.object({
  email: zEmail,
  password: zNonEmptyString.max(256),
});

export const authRefreshSchema = z.object({
  refresh_token: zNonEmptyString.max(4096),
});

export const passthroughObjectSchema = z.object({}).passthrough();

