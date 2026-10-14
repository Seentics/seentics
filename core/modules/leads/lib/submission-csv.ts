import type { StoredSubmission } from "../interfaces";
import { csvCell } from "./sanitize";

const BASE = ["submitted_at", "email", "name", "phone", "consent", "variant", "prize", "coupon_code", "page_url", "referrer"];

/**
 * One form's submissions as CSV: fixed columns, then one column per extra field the rows
 * used (sorted, so the layout does not depend on which row came first).
 */
export function submissionsToCsv(rows: readonly StoredSubmission[]): string {
  const extra = [...new Set(rows.flatMap((r) => Object.keys(r.fields)))].sort();
  const lines = [[...BASE, ...extra].map(csvCell).join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.created_at, r.email, r.name, r.phone, r.consent, r.variant ?? "", r.prize?.label ?? "", r.prize?.coupon_code ?? "",
        r.page_url, r.referrer, ...extra.map((key) => r.fields[key] ?? ""),
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return lines.join("\r\n") + "\r\n";
}
