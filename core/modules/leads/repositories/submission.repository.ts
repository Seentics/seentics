import { sql } from "../../../db";
import type { FormSummary, LeadSubmission, Prize, SiteSubmissionQuery, SiteSubmissionRow, StoredSubmission, SubmissionListQuery, WebsiteLeadSummary } from "../interfaces";

/** Stored submissions are kept this long. The monthly plan limit counts them, so keep it above a month. */
export const SUBMISSION_RETENTION_DAYS = 90;

const COLUMNS = sql`
  id, email, name, phone, consent, fields, prize, variant, page_url, referrer, created_at
`;

/** `ILIKE` metacharacters in a search term are matched literally. */
function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, "\\$&")}%`;
}

/**
 * Store one submission under an id the caller chose, so the delivery queue can refer to it.
 *
 * `automation_id` is stored as given: the capture service has already checked, through the
 * automations module, that it exists on this website.
 */
export async function insertSubmission(id: string, s: LeadSubmission, prize: Prize | null): Promise<void> {
  await sql`
    INSERT INTO form_submissions
      (id, website_id, automation_id, variant, email, name, phone, consent, fields, prize,
       page_url, referrer, session_id, anonymous_id)
    VALUES (
      ${id}::uuid, ${s.websiteId}::uuid, ${s.automationId}::uuid, ${s.variant}, ${s.email}, ${s.name},
      ${s.phone}, ${s.consent}, ${JSON.stringify(s.fields)}::jsonb,
      ${prize ? JSON.stringify(prize) : null}::jsonb, ${s.pageUrl}, ${s.referrer}, ${s.sessionId}, ${s.anonymousId}
    )
  `;
}

/** Undo `insertSubmission` when the lead could not be queued. */
export async function removeSubmissionById(id: string): Promise<void> {
  await sql`DELETE FROM form_submissions WHERE id = ${id}::uuid`;
}

export async function listSubmissions(
  websiteId: string,
  automationId: string,
  q: SubmissionListQuery,
): Promise<{ rows: StoredSubmission[]; total: number }> {
  const search = q.search ? sql`AND (email ILIKE ${likePattern(q.search)} OR name ILIKE ${likePattern(q.search)})` : sql``;
  const [rows, totals] = await Promise.all([
    sql<StoredSubmission[]>`
      SELECT ${COLUMNS} FROM form_submissions
      WHERE website_id = ${websiteId}::uuid AND automation_id = ${automationId}::uuid ${search}
      ORDER BY created_at DESC
      LIMIT ${q.limit} OFFSET ${q.offset}
    `,
    sql<[{ c: number }]>`
      SELECT COUNT(*)::int AS c FROM form_submissions
      WHERE website_id = ${websiteId}::uuid AND automation_id = ${automationId}::uuid ${search}
    `,
  ]);
  return { rows: [...rows], total: totals[0]?.c ?? 0 };
}

export async function formSummary(websiteId: string, automationId: string): Promise<FormSummary> {
  const [counts, variants] = await Promise.all([
    sql<[{ total: number; last_7_days: number; last_30_days: number; with_prize: number }]>`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::int AS last_7_days,
             COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '30 days')::int AS last_30_days,
             COUNT(*) FILTER (WHERE prize IS NOT NULL)::int AS with_prize
      FROM form_submissions
      WHERE website_id = ${websiteId}::uuid AND automation_id = ${automationId}::uuid
    `,
    sql<{ variant: string; count: number }[]>`
      SELECT variant, COUNT(*)::int AS count FROM form_submissions
      WHERE website_id = ${websiteId}::uuid AND automation_id = ${automationId}::uuid AND variant IS NOT NULL
      GROUP BY variant ORDER BY count DESC, variant ASC LIMIT 20
    `,
  ]);
  const c = counts[0];
  return {
    total: c?.total ?? 0,
    last_7_days: c?.last_7_days ?? 0,
    last_30_days: c?.last_30_days ?? 0,
    with_prize: c?.with_prize ?? 0,
    by_variant: [...variants],
  };
}

export async function websiteSummary(websiteId: string, monthStart: Date): Promise<WebsiteLeadSummary> {
  const [row] = await sql<[{ total: number; last_7_days: number; this_month: number }]>`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::int AS last_7_days,
           COUNT(*) FILTER (WHERE created_at >= ${monthStart})::int AS this_month
    FROM form_submissions WHERE website_id = ${websiteId}::uuid
  `;
  return { total: row?.total ?? 0, last_7_days: row?.last_7_days ?? 0, this_month: row?.this_month ?? 0 };
}

export async function exportSubmissions(websiteId: string, automationId: string, limit: number): Promise<StoredSubmission[]> {
  const rows = await sql<StoredSubmission[]>`
    SELECT ${COLUMNS} FROM form_submissions
    WHERE website_id = ${websiteId}::uuid AND automation_id = ${automationId}::uuid
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return [...rows];
}

export async function deleteSubmission(websiteId: string, automationId: string, id: string): Promise<boolean> {
  const rows = await sql`
    DELETE FROM form_submissions
    WHERE id = ${id}::uuid AND website_id = ${websiteId}::uuid AND automation_id = ${automationId}::uuid
    RETURNING id
  `;
  return rows.length > 0;
}

/** Submissions since `since` across the websites, for the plan limit. */
export async function countSince(websiteIds: readonly string[], since: Date): Promise<number> {
  if (websiteIds.length === 0) return 0;
  const [row] = await sql<[{ c: number }]>`
    SELECT COUNT(*)::int AS c FROM form_submissions
    WHERE website_id = ANY(${websiteIds as string[]}::uuid[]) AND created_at >= ${since}
  `;
  return row?.c ?? 0;
}

export async function purgeBefore(websiteId: string, cutoff: Date): Promise<number> {
  const rows = await sql`
    DELETE FROM form_submissions WHERE website_id = ${websiteId}::uuid AND created_at < ${cutoff} RETURNING id
  `;
  return rows.length;
}

// ---------------------------------------------------------------------------
// The site-wide inbox: every form's submissions on one list.

const SITE_COLUMNS = sql`
  s.id, s.email, s.name, s.phone, s.consent, s.fields, s.prize, s.variant, s.page_url, s.referrer, s.created_at,
  s.automation_id, s.session_id,
  (SELECT c.id FROM contacts c WHERE c.website_id = s.website_id AND c.email = s.email) AS contact_id
`;

function siteFilters(websiteId: string, q: Pick<SiteSubmissionQuery, "search" | "form" | "from" | "to">) {
  const search = q.search
    ? sql`AND (s.email ILIKE ${likePattern(q.search)} OR s.name ILIKE ${likePattern(q.search)} OR s.phone ILIKE ${likePattern(q.search)})`
    : sql``;
  const form = q.form ? sql`AND s.automation_id = ${q.form}::uuid` : sql``;
  const from = q.from ? sql`AND s.created_at >= ${q.from}` : sql``;
  const to = q.to ? sql`AND s.created_at < ${q.to}` : sql``;
  return sql`s.website_id = ${websiteId}::uuid ${search} ${form} ${from} ${to}`;
}

export async function listSiteSubmissions(
  websiteId: string,
  q: SiteSubmissionQuery,
): Promise<{ rows: SiteSubmissionRow[]; total: number }> {
  const [rows, totals] = await Promise.all([
    sql<SiteSubmissionRow[]>`
      SELECT ${SITE_COLUMNS} FROM form_submissions s WHERE ${siteFilters(websiteId, q)}
      ORDER BY s.created_at DESC, s.id LIMIT ${q.limit} OFFSET ${q.offset}
    `,
    sql<[{ c: number }]>`SELECT COUNT(*)::int AS c FROM form_submissions s WHERE ${siteFilters(websiteId, q)}`,
  ]);
  return { rows: [...rows], total: totals[0]?.c ?? 0 };
}

export async function exportSiteSubmissions(websiteId: string, q: SiteSubmissionQuery, limit: number): Promise<SiteSubmissionRow[]> {
  const rows = await sql<SiteSubmissionRow[]>`
    SELECT ${SITE_COLUMNS} FROM form_submissions s WHERE ${siteFilters(websiteId, q)}
    ORDER BY s.created_at DESC, s.id LIMIT ${limit}
  `;
  return [...rows];
}

/** One person's stored submissions, newest first. */
export async function submissionsForEmail(websiteId: string, email: string, limit: number): Promise<SiteSubmissionRow[]> {
  const rows = await sql<SiteSubmissionRow[]>`
    SELECT ${SITE_COLUMNS} FROM form_submissions s
    WHERE s.website_id = ${websiteId}::uuid AND s.email = ${email}
    ORDER BY s.created_at DESC LIMIT ${limit}
  `;
  return [...rows];
}

/** The forms that have stored submissions, with how many. Unattributed ones are left out. */
export async function formCounts(websiteId: string): Promise<{ id: string; count: number }[]> {
  const rows = await sql<{ id: string; count: number }[]>`
    SELECT automation_id AS id, COUNT(*)::int AS count FROM form_submissions
    WHERE website_id = ${websiteId}::uuid AND automation_id IS NOT NULL
    GROUP BY automation_id ORDER BY count DESC LIMIT 200
  `;
  return [...rows];
}

/** Erase one submission anywhere on the site. */
export async function deleteSiteSubmission(websiteId: string, id: string): Promise<boolean> {
  const rows = await sql`DELETE FROM form_submissions WHERE id = ${id}::uuid AND website_id = ${websiteId}::uuid RETURNING id`;
  return rows.length > 0;
}
