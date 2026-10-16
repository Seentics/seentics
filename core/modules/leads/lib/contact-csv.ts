import type { ContactView, SiteSubmissionView } from "../interfaces";
import { csvCell } from "./sanitize";

const CONTACT_COLUMNS = [
  "email", "name", "phone", "status", "tags", "notes", "source", "submissions",
  "first_seen_at", "last_activity_at", "first_channel", "first_page_url", "first_referrer",
];

/**
 * Contacts as CSV. The column names match what the import reads, so an export can be
 * edited and imported back.
 */
export function contactsToCsv(rows: readonly ContactView[]): string {
  const lines = [CONTACT_COLUMNS.map(csvCell).join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.email, r.name, r.phone, r.status, r.tags.join("; "), r.notes, r.source, r.submission_count,
        r.first_seen_at, r.last_activity_at, r.first_channel ?? "", r.first_page_url ?? "", r.first_referrer ?? "",
      ].map(csvCell).join(","),
    );
  }
  return lines.join("\r\n") + "\r\n";
}

const SITE_BASE = ["submitted_at", "email", "name", "phone", "consent", "form", "channel", "utm_source", "utm_campaign", "page_url", "referrer"];

/** Every form's submissions as CSV: fixed columns, then one per extra field the rows used. */
export function siteSubmissionsToCsv(rows: readonly SiteSubmissionView[]): string {
  const extra = [...new Set(rows.flatMap((r) => Object.keys(r.fields)))].sort();
  const lines = [[...SITE_BASE, ...extra].map(csvCell).join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.created_at, r.email, r.name, r.phone, r.consent, r.form_name ?? "", r.channel, r.utm_source ?? "", r.utm_campaign ?? "",
        r.page_url, r.referrer, ...extra.map((key) => r.fields[key] ?? ""),
      ].map(csvCell).join(","),
    );
  }
  return lines.join("\r\n") + "\r\n";
}
