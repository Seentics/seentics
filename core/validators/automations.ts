import { z } from "zod";
import { zNonEmptyString } from "./validation";
import { validateWebhookUrl } from "../lib/origin";

const ALLOWED_HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
const FORBIDDEN_HEADER_NAMES = new Set(['host', 'authorization', 'cookie', 'set-cookie', 'content-length', 'transfer-encoding']);

const webhookActionSchema = z.object({
  type: z.literal('webhook'),
  url: z.string().refine(validateWebhookUrl, { message: 'Invalid or disallowed webhook URL (must be https, non-internal)' }),
  method: z.enum(ALLOWED_HTTP_METHODS).optional().default('POST'),
  headers: z.record(z.string().max(4096)).optional().refine(
    (h) => !h || Object.keys(h).every((k) => !FORBIDDEN_HEADER_NAMES.has(k.toLowerCase())),
    { message: 'One or more header names are not allowed' }
  ),
  body: z.unknown().optional(),
});

export const automationsUpsertBodySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  enabled: z.boolean().optional(),
  trigger: z.string().max(100).optional(),
  conditions: z.unknown().optional().nullable(),
  actions: z.array(webhookActionSchema).max(10).optional(),
}).passthrough();

export const automationsBulkDeleteSchema = z.object({
  ids: z.array(zNonEmptyString.max(128)).max(500).optional().default([]),
});

