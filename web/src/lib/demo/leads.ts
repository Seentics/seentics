/**
 * The demo site's Leads page: every demo form's submissions in one list, and the contacts they
 * became, plus a few contacts added by hand or imported.
 *
 * Built on `demo/submissions` so a person's submissions, deliveries and dates agree with the
 * automation pages. Addresses are on `example.com`, a domain reserved for documentation.
 */
import type {
  Contact, ContactDetail, ContactFilters, ContactPage, ContactStatus, LeadChannel, LeadForm, LeadsOverview,
  SiteSubmission, SiteSubmissionFilters, SiteSubmissionPage,
} from '@/features/leads/types';
import { CONTACT_STATUSES } from '@/features/leads/types';
import { DEMO_FORMS, demoAllSubmissions } from './submissions';
import { demoIso } from './integrations';

const DAY = 86_400_000;
const FORM_NAMES: Record<string, string> = Object.fromEntries(Object.values(DEMO_FORMS).map((f) => [f.id, f.name]));
/** The one demo session with a real recording behind it (demo/replays). */
const RECORDED_SESSION = 'demo-session-4821';

/** Where each demo visitor came from, varied but fixed, so the page reads like a real mix. */
const ARRIVALS: { channel: LeadChannel; utm_source: string | null; utm_campaign: string | null }[] = [
  { channel: 'paid', utm_source: 'facebook', utm_campaign: 'spring_sale' },
  { channel: 'organic', utm_source: null, utm_campaign: null },
  { channel: 'paid', utm_source: 'google', utm_campaign: 'brand_search' },
  { channel: 'social', utm_source: 'instagram', utm_campaign: null },
  { channel: 'direct', utm_source: null, utm_campaign: null },
  { channel: 'email', utm_source: 'newsletter', utm_campaign: 'march_digest' },
  { channel: 'referral', utm_source: null, utm_campaign: null },
];

const contactId = (email: string) => `demo-contact-${email.split('@')[0]!.replace(/\W/g, '-')}`;

const SUBMISSIONS: SiteSubmission[] = demoAllSubmissions().map(({ form_id, ...s }, i) => {
  const arrival = s.referrer ? ARRIVALS[1]! : ARRIVALS[i % ARRIVALS.length]!;
  return {
    ...s,
    automation_id: form_id,
    form_name: FORM_NAMES[form_id] ?? null,
    session_id: i % 3 === 0 ? RECORDED_SESSION : `demo-session-${9000 + i}`,
    has_replay: i % 3 === 0,
    ...arrival,
    contact_id: contactId(s.email),
  };
});

/** Status, tags and notes for the people who filled in a demo form. */
const CRM: Record<string, Pick<Contact, 'status' | 'tags' | 'notes'>> = {
  'ava.martin': { status: 'new', tags: ['wheel-winner'], notes: '' },
  'liam.becker': { status: 'customer', tags: ['vip', 'wheel-winner'], notes: 'Bought the annual plan after the second spin.' },
  'noah.kim': { status: 'contacted', tags: ['newsletter'], notes: 'Sent the getting-started guide.' },
  'zara.ahmed': { status: 'qualified', tags: ['agency', 'newsletter'], notes: 'Runs Northwind Studio, 12 client sites. Wants a demo of client accounts.' },
  'mia.okafor': { status: 'contacted', tags: ['newsletter'], notes: '' },
  'hana.sato': { status: 'customer', tags: ['wheel-winner'], notes: '' },
  'lucas.dubois': { status: 'lost', tags: [], notes: 'Chose another tool.' },
};

/** People who never filled in a form here: added after a call, or brought over from a spreadsheet. */
const OTHERS: Contact[] = [
  { name: 'Grace Lee', slug: 'grace.lee', phone: '+1 415 555 0182', status: 'qualified', tags: ['event', 'agency'], notes: 'Met at the Berlin meetup. Follow up next week.', source: 'manual', agoMs: 3 * DAY },
  { name: 'Tomás Herrera', slug: 'tomas.herrera', phone: '', status: 'new', tags: ['import'], notes: '', source: 'import', agoMs: 8 * DAY },
  { name: 'Priya Nair', slug: 'priya.nair', phone: '+91 80 5550 1234', status: 'customer', tags: ['import', 'vip'], notes: 'Moved over from the old CRM.', source: 'import', agoMs: 8 * DAY },
].map((c) => ({
  id: contactId(`${c.slug}@example.com`), email: `${c.slug}@example.com`, name: c.name, phone: c.phone,
  status: c.status as ContactStatus, tags: c.tags, notes: c.notes, source: c.source as Contact['source'],
  submission_count: 0, first_seen_at: demoIso(-c.agoMs), last_activity_at: demoIso(-c.agoMs),
  created_at: demoIso(-c.agoMs), updated_at: demoIso(-c.agoMs), first_channel: null, first_campaign: null, first_page_url: null, first_referrer: null,
}));

function buildContacts(): Contact[] {
  const byEmail = new Map<string, SiteSubmission[]>();
  for (const s of SUBMISSIONS) byEmail.set(s.email, [...(byEmail.get(s.email) ?? []), s]);
  const fromForms = [...byEmail.entries()].map(([email, subs]): Contact => {
    // `subs` is newest first, like SUBMISSIONS.
    const first = subs[subs.length - 1]!;
    const latest = subs[0]!;
    const crm = CRM[email.split('@')[0]!] ?? { status: 'new' as const, tags: [], notes: '' };
    return {
      id: contactId(email), email, name: latest.name, phone: subs.find((s) => s.phone)?.phone ?? '',
      ...crm, source: 'form', submission_count: subs.length,
      first_seen_at: first.created_at, last_activity_at: latest.created_at, created_at: first.created_at, updated_at: latest.created_at,
      first_channel: first.channel, first_campaign: first.utm_campaign, first_page_url: first.page_url, first_referrer: first.referrer || null,
    };
  });
  return [...fromForms, ...OTHERS];
}
const CONTACTS = buildContacts();

const matchesText = (term: string, ...values: string[]) => !term || values.some((v) => v.toLowerCase().includes(term));

function filterSubmissions(f: Omit<SiteSubmissionFilters, 'limit' | 'offset'>): SiteSubmission[] {
  const term = f.search.trim().toLowerCase();
  return SUBMISSIONS.filter((s) =>
    matchesText(term, s.email, s.name, s.phone)
    && (!f.form || s.automation_id === f.form)
    && (!f.from || s.created_at >= f.from)
    && (!f.to || s.created_at <= f.to)
    && (f.delivery !== 'failed' || s.deliveries.some((d) => d.status === 'failed')));
}

export function demoSiteSubmissionsPage(f: SiteSubmissionFilters): SiteSubmissionPage {
  const rows = filterSubmissions(f);
  return { submissions: rows.slice(f.offset, f.offset + f.limit), total: rows.length };
}

export function demoLeadForms(): LeadForm[] {
  return Object.values(DEMO_FORMS).map((form) => ({ ...form, count: SUBMISSIONS.filter((s) => s.automation_id === form.id).length }));
}

function filterContacts(f: Omit<ContactFilters, 'limit' | 'offset' | 'status'>): Contact[] {
  const term = f.search.trim().toLowerCase();
  const key = f.sort === 'created' ? 'created_at' : 'last_activity_at';
  return CONTACTS
    .filter((c) => matchesText(term, c.email, c.name, c.phone) && (!f.tag || c.tags.includes(f.tag)) && (!f.source || c.source === f.source)
      && (!f.channel || c.first_channel === f.channel) && (!f.campaign || c.first_campaign === f.campaign))
    .sort((a, b) => b[key].localeCompare(a[key]));
}

/** Every tag on the demo contacts, most used first, as `GET /contacts/tags` answers. */
export function demoContactTags(): { tag: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const c of CONTACTS) for (const t of c.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  return [...counts].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

export function demoContactsPage(f: ContactFilters): ContactPage {
  // The status counts describe the other filters' result, so each chip says what picking it would show.
  const rest = filterContacts(f);
  const statuses = Object.fromEntries(CONTACT_STATUSES.map((s) => [s, rest.filter((c) => c.status === s).length])) as ContactPage['statuses'];
  const rows = f.status ? rest.filter((c) => c.status === f.status) : rest;
  return { contacts: rows.slice(f.offset, f.offset + f.limit), total: rows.length, statuses };
}

export function demoContactDetail(id: string): ContactDetail | null {
  const contact = CONTACTS.find((c) => c.id === id);
  if (!contact) return null;
  return { contact, submissions: SUBMISSIONS.filter((s) => s.contact_id === id) };
}

const csvCell = (value: unknown) => {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
const csv = (header: string[], rows: unknown[][]) => [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');

export function demoSiteSubmissionsCsv(f: Omit<SiteSubmissionFilters, 'limit' | 'offset'>): string {
  return csv(
    ['submitted_at', 'email', 'name', 'phone', 'consent', 'form', 'channel', 'utm_campaign', 'page_url'],
    filterSubmissions(f).map((s) => [s.created_at, s.email, s.name, s.phone, s.consent, s.form_name ?? '', s.channel, s.utm_campaign ?? '', s.page_url]),
  );
}

export function demoContactsCsv(f: Omit<ContactFilters, 'limit' | 'offset'>): string {
  const rows = filterContacts(f).filter((c) => !f.status || c.status === f.status);
  return csv(
    ['email', 'name', 'phone', 'status', 'tags', 'notes', 'source', 'submissions', 'first_seen_at', 'last_activity_at'],
    rows.map((c) => [c.email, c.name, c.phone, c.status, c.tags.join(';'), c.notes, c.source, c.submission_count, c.first_seen_at, c.last_activity_at]),
  );
}

/**
 * The demo's numbers, from the same submissions and contacts the lists show, over the window
 * ending at the demo's fixed "now" (`demoIso(0)`).
 */
/** Core's lib/source.ts in brief, for the demo: the UTM source, else the referrer's site, by name. */
function demoSource(s: { utm_source: string | null; referrer: string }): string | null {
  const raw = s.utm_source?.toLowerCase() || (() => { try { return new URL(s.referrer).hostname.replace(/^www\./, ''); } catch { return null; } })();
  if (!raw) return null;
  if (/^(fb|facebook)$|facebook\.com$/.test(raw)) return 'facebook';
  if (/^(ig|instagram)$|instagram\.com$/.test(raw)) return 'instagram';
  if (/^google$|google\./.test(raw)) return 'google';
  return raw;
}

export function demoLeadsOverview(days: number): LeadsOverview {
  const since = demoIso(-days * DAY);
  const recent = SUBMISSIONS.filter((s) => s.created_at >= since);
  const fresh = CONTACTS.filter((c) => c.first_seen_at >= since);
  const tally = <K extends string>(keys: (K | null)[]) => {
    const m = new Map<K, number>();
    for (const k of keys) if (k) m.set(k, (m.get(k) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  return {
    days,
    submissions: recent.length,
    new_contacts: fresh.length,
    customers: fresh.filter((c) => c.status === 'customer').length,
    by_channel: tally(recent.map((s) => s.channel)).map(([channel, count]) => ({ channel, count })),
    by_source: tally(recent.map(demoSource)).slice(0, 6).map(([source, count]) => ({ source, count })),
    by_campaign: tally(recent.map((s) => s.utm_campaign)).slice(0, 5).map(([campaign, count]) => ({
      campaign, count, source: tally(recent.filter((s) => s.utm_campaign === campaign).map(demoSource))[0]?.[0] ?? null,
    })),
    failed_deliveries: recent.filter((s) => s.deliveries.some((d) => d.status === 'failed')).length,
  };
}
