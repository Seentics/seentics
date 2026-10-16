import type { ContactStatus, ImportResult, ImportRowInput } from "../interfaces";
import { CONTACT_STATUSES } from "../interfaces";

/** One row of an import, cleaned: what the repository stores. */
export type ImportRow = { email: string; name: string; phone: string; status: ContactStatus | null; tags: string[]; notes: string };

/** The most tags a contact may carry, and the longest one. */
export const MAX_TAGS = 20;
export const MAX_TAG_LENGTH = 40;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Undo the export's spreadsheet-formula guard: `csvCell` prefixes a value starting with
 * = + - @ with an apostrophe, so a phone number exports as '+880… — imported back, it should
 * be the number again.
 */
export function undefuse(value: string): string {
  return /^'[=+\-@\t\r]/.test(value) ? value.slice(1) : value;
}

/** Trimmed, de-duplicated, length-capped tags, in the order first given. */
export function normalizeTags(tags: readonly string[] | undefined): string[] {
  const out: string[] = [];
  for (const raw of tags ?? []) {
    const tag = raw.trim().slice(0, MAX_TAG_LENGTH);
    if (tag && !out.includes(tag)) out.push(tag);
    if (out.length === MAX_TAGS) break;
  }
  return out;
}

export function isContactStatus(value: unknown): value is ContactStatus {
  return typeof value === "string" && (CONTACT_STATUSES as readonly string[]).includes(value);
}

/**
 * Turn a file's rows into what can be stored, with a reason for each one that cannot.
 *
 * Row numbers are 1-based positions in `rows`, as the person importing counts them. A later
 * row for an email already seen replaces the earlier one, so a file with duplicates has one
 * clear outcome per address.
 */
export function prepareImport(rows: readonly ImportRowInput[]): { rows: ImportRow[]; errors: ImportResult["errors"] } {
  const errors: ImportResult["errors"] = [];
  const byEmail = new Map<string, ImportRow>();
  rows.forEach((r, i) => {
    const row = i + 1;
    const email = (r.email ?? "").trim().toLowerCase();
    if (!email) return errors.push({ row, reason: "No email" });
    if (email.length > 254 || !EMAIL.test(email)) return errors.push({ row, reason: `Not an email address: ${email.slice(0, 60)}` });
    const status = (r.status ?? "").trim().toLowerCase();
    if (status && !isContactStatus(status)) {
      return errors.push({ row, reason: `Unknown status "${status.slice(0, 20)}" (use ${CONTACT_STATUSES.join(", ")})` });
    }
    byEmail.set(email, {
      email,
      name: undefuse((r.name ?? "").trim()).slice(0, 200),
      phone: undefuse((r.phone ?? "").trim()).slice(0, 50),
      status: status ? (status as ContactStatus) : null,
      tags: normalizeTags(r.tags),
      notes: undefuse((r.notes ?? "").trim()).slice(0, 5000),
    });
  });
  return { rows: [...byEmail.values()], errors };
}

