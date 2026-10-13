import { sql } from "../../../db";
import type {
  Contact,
  ContactListQuery,
  ContactStatus,
  ContactSubmission,
  LeadStats,
  LeadSubmission,
} from "../interfaces";

const CONTACT_COLUMNS = sql`
  id, email, name, phone, status, consent, submission_count,
  first_submitted_at, last_submitted_at
`;

/** `ILIKE` metacharacters in a search term are matched literally. */
function likePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, "\\$&")}%`;
}

/**
 * Create the contact or refresh the existing one, then add the submission.
 *
 * One transaction, so a submission never exists without its contact. The upsert keeps
 * what the visitor has already given: a later submission that leaves `name` blank does
 * not erase the earlier one, and consent, once given, is not silently withdrawn by a
 * form that does not ask. `xmax = 0` tells an insert from an update without a second
 * query, which is how the caller knows whether the contact is new.
 *
 * `automation_id` is stored as given: the capture service has already checked, through
 * the automations module, that it exists on this website.
 */
export async function insertSubmission(
  s: LeadSubmission,
): Promise<{ contactId: string; isNewContact: boolean }> {
  return sql.begin(async (tx) => {
    const [contact] = await tx<{ id: string; inserted: boolean }[]>`
      INSERT INTO contacts (website_id, email, name, phone, consent, anonymous_id)
      VALUES (${s.websiteId}::uuid, ${s.email}, ${s.name}, ${s.phone}, ${s.consent}, ${s.anonymousId})
      ON CONFLICT (website_id, email) DO UPDATE SET
        name = CASE WHEN EXCLUDED.name <> '' THEN EXCLUDED.name ELSE contacts.name END,
        phone = CASE WHEN EXCLUDED.phone <> '' THEN EXCLUDED.phone ELSE contacts.phone END,
        consent = contacts.consent OR EXCLUDED.consent,
        anonymous_id = COALESCE(EXCLUDED.anonymous_id, contacts.anonymous_id),
        submission_count = contacts.submission_count + 1,
        last_submitted_at = NOW(),
        updated_at = NOW()
      RETURNING id, (xmax = 0) AS inserted
    `;

    await tx`
      INSERT INTO lead_submissions
        (website_id, contact_id, automation_id, variant, fields, page_url, referrer, session_id)
      VALUES (
        ${s.websiteId}::uuid,
        ${contact!.id}::uuid,
        ${s.automationId}::uuid,
        ${s.variant},
        ${JSON.stringify(s.fields)}::jsonb,
        ${s.pageUrl},
        ${s.referrer},
        ${s.sessionId}
      )
    `;
    return { contactId: contact!.id, isNewContact: contact!.inserted };
  });
}

export async function listContacts(
  websiteId: string,
  q: ContactListQuery,
): Promise<{ contacts: Contact[]; total: number }> {
  const search = q.search ? sql`AND (email ILIKE ${likePattern(q.search)} OR name ILIKE ${likePattern(q.search)})` : sql``;
  const status = q.status ? sql`AND status = ${q.status}` : sql``;

  const [contacts, totals] = await Promise.all([
    sql<Contact[]>`
      SELECT ${CONTACT_COLUMNS} FROM contacts
      WHERE website_id = ${websiteId}::uuid ${search} ${status}
      ORDER BY last_submitted_at DESC
      LIMIT ${q.limit} OFFSET ${q.offset}
    `,
    sql<[{ c: number }]>`
      SELECT COUNT(*)::int AS c FROM contacts
      WHERE website_id = ${websiteId}::uuid ${search} ${status}
    `,
  ]);
  return { contacts: [...contacts], total: totals[0]?.c ?? 0 };
}

export async function getContact(
  websiteId: string,
  contactId: string,
): Promise<{ contact: Contact; submissions: ContactSubmission[] } | null> {
  const [contact] = await sql<Contact[]>`
    SELECT ${CONTACT_COLUMNS} FROM contacts
    WHERE id = ${contactId}::uuid AND website_id = ${websiteId}::uuid
  `;
  if (!contact) return null;

  const submissions = await sql<ContactSubmission[]>`
    SELECT id, automation_id, NULL::text AS automation_name, variant, fields,
           page_url, referrer, created_at
    FROM lead_submissions
    WHERE contact_id = ${contactId}::uuid AND website_id = ${websiteId}::uuid
    ORDER BY created_at DESC
    LIMIT 100
  `;
  return { contact, submissions: [...submissions] as ContactSubmission[] };
}

export async function leadStats(websiteId: string): Promise<LeadStats> {
  const [totals] = await sql<[{ total: number; last_7_days: number }]>`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE first_submitted_at > NOW() - INTERVAL '7 days')::int AS last_7_days
    FROM contacts WHERE website_id = ${websiteId}::uuid
  `;
  const byAutomation = await sql<LeadStats["by_automation"]>`
    SELECT automation_id, NULL::text AS name, COUNT(*)::int AS count
    FROM lead_submissions
    WHERE website_id = ${websiteId}::uuid
    GROUP BY automation_id
    ORDER BY count DESC
    LIMIT 20
  `;
  return {
    total: totals?.total ?? 0,
    last_7_days: totals?.last_7_days ?? 0,
    by_automation: [...byAutomation],
  };
}

export async function exportContacts(websiteId: string, limit: number): Promise<Contact[]> {
  const rows = await sql<Contact[]>`
    SELECT ${CONTACT_COLUMNS} FROM contacts
    WHERE website_id = ${websiteId}::uuid
    ORDER BY first_submitted_at ASC
    LIMIT ${limit}
  `;
  return [...rows];
}

export async function updateContactStatus(
  websiteId: string,
  contactId: string,
  status: ContactStatus,
): Promise<boolean> {
  const rows = await sql`
    UPDATE contacts SET status = ${status}, updated_at = NOW()
    WHERE id = ${contactId}::uuid AND website_id = ${websiteId}::uuid
    RETURNING id
  `;
  return rows.length > 0;
}

export async function deleteContact(websiteId: string, contactId: string): Promise<boolean> {
  const rows = await sql`
    DELETE FROM contacts
    WHERE id = ${contactId}::uuid AND website_id = ${websiteId}::uuid
    RETURNING id
  `;
  return rows.length > 0;
}
