import type { LeadFields } from "../interfaces";

const MAX_FIELDS = 20;
const MAX_VALUE_LENGTH = 1000;
const FIELD_KEY = /^[a-z][a-z0-9_]{0,39}$/i;

/** Control characters other than tab and newline: they have no place in a form answer. */
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function cleanText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  return value.replace(CONTROL_CHARS, "").trim().slice(0, max);
}

export function normalizeEmail(value: unknown): string {
  return cleanText(value, 254).toLowerCase();
}

/**
 * Reduce a form's extra answers to something safe to store and show.
 *
 * Anything that is not a short string, finite number or boolean is dropped rather than
 * coerced: the browser is anonymous, so a nested object here is an attempt to store
 * something large or to confuse a later reader, not a form answer. Keys are restricted
 * to identifier-shaped names so they can be used as CSV columns and JSON keys without
 * escaping, and the count is capped.
 */
export function sanitizeFields(input: unknown): LeadFields {
  const out: LeadFields = {};
  if (!input || typeof input !== "object" || Array.isArray(input)) return out;

  for (const [key, raw] of Object.entries(input as Record<string, unknown>)) {
    if (Object.keys(out).length >= MAX_FIELDS) break;
    if (!FIELD_KEY.test(key)) continue;
    if (typeof raw === "string") {
      const text = cleanText(raw, MAX_VALUE_LENGTH);
      if (text) out[key] = text;
    } else if (typeof raw === "number" && Number.isFinite(raw)) {
      out[key] = raw;
    } else if (typeof raw === "boolean") {
      out[key] = raw;
    }
  }
  return out;
}

/**
 * Neutralise a cell for a spreadsheet.
 *
 * A value starting with `=`, `+`, `-` or `@` is read as a formula by Excel and Sheets, and
 * a lead's name is attacker-controlled text that the site owner will open in exactly
 * those tools. A leading apostrophe makes it plain text; the quote handling is separate.
 */
export function csvCell(value: unknown): string {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
