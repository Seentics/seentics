import { sql } from "../../../db";
import type {
  ContactBulkChange,
  ContactInput,
  ContactListQuery,
  ContactPatch,
  ContactRow,
  ContactSource,
  ContactStatus,
  LeadSubmission,
} from "../interfaces";
import { CONTACT_STATUSES } from "../interfaces";
import type { ImportRow } from "../lib/contact-import";

/**
 * The contacts table: one row per website and email, kept until the owner deletes it.
 *
 * Every statement is scoped by website. A contact's submissions are found by email
 * (`form_submissions.email` is stored the same way, trimmed and lower-cased), and the count
 * shown beside a contact is of the submissions still stored — they age out after 90 days.
 */

const COLUMNS = sql`
  c.id, c.email, c.name, c.phone, c.status, c.tags, c.notes, c.source,
  c.first_seen_at, c.last_activity_at, c.created_at, c.updated_at, c.first_page_url, c.first_referrer,
  (SELECT COUNT(*)::int FROM form_submissions s WHERE s.website_id = c.website_id AND s.email = c.email) AS submission_count
`;

function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, "\\$&")}%`;
}

function filters(websiteId: string, q: Pick<ContactListQuery, "search" | "status" | "tag" | "source">) {
  const search = q.search
    ? sql`AND (c.email ILIKE ${likePattern(q.search)} OR c.name ILIKE ${likePattern(q.search)} OR c.phone ILIKE ${likePattern(q.search)})`
    : sql``;
  const status = q.status ? sql`AND c.status = ${q.status}` : sql``;
  const tag = q.tag ? sql`AND ${q.tag} = ANY(c.tags)` : sql``;
  const source = q.source ? sql`AND c.source = ${q.source}` : sql``;
  return sql`c.website_id = ${websiteId}::uuid ${search} ${status} ${tag} ${source}`;
}

export async function listContacts(
  websiteId: string,
  q: ContactListQuery,
): Promise<{ rows: ContactRow[]; total: number; statuses: Record<ContactStatus, number> }> {
  const order = q.sort === "created" ? sql`c.created_at DESC` : sql`c.last_activity_at DESC`;
  const [rows, totals, byStatus] = await Promise.all([
    sql<ContactRow[]>`
      SELECT ${COLUMNS} FROM contacts c WHERE ${filters(websiteId, q)}
      ORDER BY ${order}, c.id LIMIT ${q.limit} OFFSET ${q.offset}
    `,
    sql<[{ c: number }]>`SELECT COUNT(*)::int AS c FROM contacts c WHERE ${filters(websiteId, q)}`,
    // Per status across the other filters, so the status chips read as "this many if you pick me".
    sql<{ status: ContactStatus; c: number }[]>`
      SELECT c.status, COUNT(*)::int AS c FROM contacts c WHERE ${filters(websiteId, { ...q, status: null })} GROUP BY c.status
    `,
  ]);
  const statuses = Object.fromEntries(CONTACT_STATUSES.map((s) => [s, 0])) as Record<ContactStatus, number>;
  for (const r of byStatus) statuses[r.status] = r.c;
  return { rows: [...rows], total: totals[0]?.c ?? 0, statuses };
}

export async function exportContacts(websiteId: string, q: ContactListQuery, limit: number): Promise<ContactRow[]> {
  const rows = await sql<ContactRow[]>`
    SELECT ${COLUMNS} FROM contacts c WHERE ${filters(websiteId, q)}
    ORDER BY c.last_activity_at DESC, c.id LIMIT ${limit}
  `;
  return [...rows];
}

export async function getContact(websiteId: string, id: string): Promise<ContactRow | null> {
  const [row] = await sql<ContactRow[]>`SELECT ${COLUMNS} FROM contacts c WHERE c.website_id = ${websiteId}::uuid AND c.id = ${id}::uuid`;
  return row ?? null;
}

/** Every tag in use on the site's contacts, most used first: the tag filter's options. */
export async function tagCounts(websiteId: string): Promise<{ tag: string; count: number }[]> {
  const rows = await sql<{ tag: string; count: number }[]>`
    SELECT t AS tag, COUNT(*)::int AS count FROM contacts c, unnest(c.tags) AS t
    WHERE c.website_id = ${websiteId}::uuid
    GROUP BY t ORDER BY count DESC, t LIMIT 500
  `;
  return [...rows];
}

/** Contact ids by email, for the submissions list. */
export async function contactIdsByEmail(websiteId: string, emails: readonly string[]): Promise<Map<string, string>> {
  const unique = [...new Set(emails)];
  if (unique.length === 0) return new Map();
  const rows = await sql<{ id: string; email: string }[]>`
    SELECT id, email FROM contacts WHERE website_id = ${websiteId}::uuid AND email = ANY(${unique}::text[])
  `;
  return new Map(rows.map((r) => [r.email, r.id]));
}

/** A new contact, or the id of the one that already has this email. */
export async function insertContact(
  websiteId: string,
  input: ContactInput,
  source: ContactSource,
): Promise<{ id: string } | { exists: string }> {
  const [row] = await sql<{ id: string }[]>`
    INSERT INTO contacts (website_id, email, name, phone, status, tags, notes, source)
    VALUES (${websiteId}::uuid, ${input.email}, ${input.name}, ${input.phone}, ${input.status},
            ${input.tags}::text[], ${input.notes}, ${source})
    ON CONFLICT (website_id, email) DO NOTHING
    RETURNING id
  `;
  if (row) return { id: row.id };
  const [existing] = await sql<{ id: string }[]>`SELECT id FROM contacts WHERE website_id = ${websiteId}::uuid AND email = ${input.email}`;
  return { exists: existing!.id };
}

export async function updateContact(websiteId: string, id: string, patch: ContactPatch): Promise<boolean> {
  // One fragment per given field; `updated_at` always, so the SET list is never empty.
  const sets = [sql`updated_at = NOW()`];
  if (patch.name !== undefined) sets.push(sql`name = ${patch.name}`);
  if (patch.phone !== undefined) sets.push(sql`phone = ${patch.phone}`);
  if (patch.status !== undefined) sets.push(sql`status = ${patch.status}`);
  if (patch.notes !== undefined) sets.push(sql`notes = ${patch.notes}`);
  if (patch.tags !== undefined) sets.push(sql`tags = ${patch.tags}::text[]`);
  const assignments = sets.reduce((all, next) => sql`${all}, ${next}`);
  const rows = await sql`
    UPDATE contacts SET ${assignments}
    WHERE website_id = ${websiteId}::uuid AND id = ${id}::uuid
    RETURNING id
  `;
  return rows.length > 0;
}

export async function bulkUpdate(websiteId: string, ids: readonly string[], change: ContactBulkChange): Promise<number> {
  if (ids.length === 0) return 0;
  const status = change.status ? sql`, status = ${change.status}` : sql``;
  const add = change.add_tags?.length
    ? sql`, tags = ARRAY(SELECT DISTINCT t FROM unnest(tags || ${change.add_tags}::text[]) AS t ORDER BY t)`
    : sql``;
  const rows = await sql`
    UPDATE contacts SET updated_at = NOW() ${status} ${add}
    WHERE website_id = ${websiteId}::uuid AND id = ANY(${ids as string[]}::uuid[])
    RETURNING id
  `;
  if (change.remove_tags?.length) {
    await sql`
      UPDATE contacts SET tags = ARRAY(SELECT t FROM unnest(tags) AS t WHERE NOT (t = ANY(${change.remove_tags}::text[])) ORDER BY t)
      WHERE website_id = ${websiteId}::uuid AND id = ANY(${ids as string[]}::uuid[])
    `;
  }
  return rows.length;
}

/**
 * Delete contacts; with `withSubmissions`, their stored submissions too, in one transaction.
 * Returns the deleted submission ids, so the caller can drop their queued deliveries.
 */
export async function deleteContacts(
  websiteId: string,
  ids: readonly string[],
  withSubmissions: boolean,
): Promise<{ deleted: number; submissionIds: string[] }> {
  if (ids.length === 0) return { deleted: 0, submissionIds: [] };
  return sql.begin(async (tx) => {
    const gone = await tx<{ email: string }[]>`
      DELETE FROM contacts WHERE website_id = ${websiteId}::uuid AND id = ANY(${ids as string[]}::uuid[]) RETURNING email
    `;
    let submissionIds: string[] = [];
    if (withSubmissions && gone.length) {
      const emails = gone.map((r) => r.email);
      const rows = await tx<{ id: string }[]>`
        DELETE FROM form_submissions WHERE website_id = ${websiteId}::uuid AND email = ANY(${emails}::text[]) RETURNING id
      `;
      submissionIds = rows.map((r) => r.id);
    }
    return { deleted: gone.length, submissionIds };
  });
}

/**
 * The contact a submission belongs to: created by their first one, refreshed by each next one.
 *
 * Name and phone are filled in where the contact has none, never overwritten — the owner may
 * have corrected them. The first-touch fields are only ever set on the row's creation.
 */
export async function upsertFromSubmission(s: LeadSubmission, at: Date): Promise<void> {
  await sql`
    INSERT INTO contacts (website_id, email, name, phone, source, first_page_url, first_referrer, anonymous_id,
                          first_seen_at, last_activity_at)
    VALUES (${s.websiteId}::uuid, ${s.email}, ${s.name}, ${s.phone}, 'form', ${s.pageUrl}, ${s.referrer}, ${s.anonymousId},
            ${at}, ${at})
    ON CONFLICT (website_id, email) DO UPDATE SET
      name = CASE WHEN contacts.name = '' THEN EXCLUDED.name ELSE contacts.name END,
      phone = CASE WHEN contacts.phone = '' THEN EXCLUDED.phone ELSE contacts.phone END,
      anonymous_id = COALESCE(EXCLUDED.anonymous_id, contacts.anonymous_id),
      last_activity_at = GREATEST(contacts.last_activity_at, EXCLUDED.last_activity_at),
      updated_at = NOW()
  `;
}


/**
 * Upsert many contacts at once, in one transaction. A new email becomes a contact. An
 * existing one is left as it is (counted as skipped), or with `updateExisting` takes the
 * file's non-empty values and gains its tags. Emails are unique within `rows` (the service
 * merges duplicates first).
 */
export async function importContacts(
  websiteId: string,
  rows: readonly ImportRow[],
  updateExisting: boolean,
): Promise<{ created: number; updated: number }> {
  if (rows.length === 0) return { created: 0, updated: 0 };
  // Tags travel as one unit-separator-joined string per row: unnest() of a text[][] flattens it.
  const SEP = "\u001f";
  const cols = {
    emails: rows.map((r) => r.email),
    names: rows.map((r) => r.name),
    phones: rows.map((r) => r.phone),
    statuses: rows.map((r) => r.status ?? ""),
    tags: rows.map((r) => r.tags.join(SEP)),
    notes: rows.map((r) => r.notes),
  };
  const input = sql`
    unnest(${cols.emails}::text[], ${cols.names}::text[], ${cols.phones}::text[], ${cols.statuses}::text[], ${cols.tags}::text[], ${cols.notes}::text[])
      AS u(email, name, phone, status, tags, notes)
  `;
  const tagArray = sql`CASE WHEN u.tags = '' THEN '{}'::text[] ELSE string_to_array(u.tags, ${SEP}) END`;

  return sql.begin(async (tx) => {
    const inserted = await tx<{ id: string }[]>`
      INSERT INTO contacts (website_id, email, name, phone, status, tags, notes, source)
      SELECT ${websiteId}::uuid, u.email, u.name, u.phone, COALESCE(NULLIF(u.status, ''), 'new'), ${tagArray}, u.notes, 'import'
      FROM ${input}
      ON CONFLICT (website_id, email) DO NOTHING
      RETURNING id
    `;
    if (!updateExisting) return { created: inserted.length, updated: 0 };
    const createdIds = inserted.map((r) => r.id);
    const updated = await tx<{ id: string }[]>`
      UPDATE contacts c SET
        name = CASE WHEN u.name <> '' THEN u.name ELSE c.name END,
        phone = CASE WHEN u.phone <> '' THEN u.phone ELSE c.phone END,
        notes = CASE WHEN u.notes <> '' THEN u.notes ELSE c.notes END,
        status = CASE WHEN u.status <> '' THEN u.status ELSE c.status END,
        tags = ARRAY(SELECT DISTINCT t FROM unnest(c.tags || ${tagArray}) AS t ORDER BY t),
        updated_at = NOW()
      FROM ${input}
      WHERE c.website_id = ${websiteId}::uuid AND c.email = u.email AND NOT (c.id = ANY(${createdIds}::uuid[]))
      RETURNING c.id
    `;
    return { created: inserted.length, updated: updated.length };
  });
}
