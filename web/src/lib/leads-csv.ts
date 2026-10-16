/**
 * Reading a spreadsheet of contacts for import: parse the CSV, guess which column is which,
 * and turn the rows into contacts, reporting the ones that cannot be imported.
 *
 * Pure functions, no DOM: the import dialog reads the file and calls these.
 */
import { CONTACT_STATUSES, type ContactStatus, type ImportRow } from '@/features/leads/types';

/**
 * RFC 4180 CSV: quoted fields may hold commas, quotes (doubled) and line breaks; CRLF or LF
 * line ends; a byte-order mark is ignored. Wholly empty lines are dropped.
 */
export function parseCsv(text: string): string[][] {
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"' && field === '') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && input[i + 1] === '\n') i++;
      row.push(field); field = '';
      rows.push(row); row = [];
    } else field += ch;
  }
  if (field !== '' || row.length > 0) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

export const IMPORT_FIELDS = ['email', 'name', 'phone', 'status', 'tags', 'notes'] as const;
export type ImportField = (typeof IMPORT_FIELDS)[number];
/** Which column feeds each field; -1 leaves the field out. */
export type ColumnMapping = Record<ImportField, number>;

const HEADER_HINTS: Record<ImportField, RegExp> = {
  email: /^(e-?mail|email address|e-?mail address|mail)$/,
  name: /^(name|full name|contact|contact name|first name|customer|customer name)$/,
  phone: /^(phone|phone number|mobile|mobile number|tel|telephone|whatsapp)$/,
  status: /^(status|stage|lead status|lifecycle stage)$/,
  tags: /^(tags?|labels?|segments?|lists?)$/,
  notes: /^(notes?|comments?|description|remarks)$/,
};

/** Each field's column, by its header; a column is used once, and email falls back to the first column holding an address. */
export function guessMapping(headers: string[], sample: string[][] = []): ColumnMapping {
  const normal = headers.map((h) => h.trim().toLowerCase().replace(/[_]+/g, ' ').replace(/\s+/g, ' '));
  const taken = new Set<number>();
  const mapping = {} as ColumnMapping;
  for (const field of IMPORT_FIELDS) {
    const index = normal.findIndex((h, i) => !taken.has(i) && HEADER_HINTS[field].test(h));
    mapping[field] = index;
    if (index >= 0) taken.add(index);
  }
  if (mapping.email < 0) {
    const index = headers.findIndex((_, i) => !taken.has(i) && sample.some((r) => EMAIL.test((r[i] ?? '').trim())));
    mapping.email = index;
  }
  return mapping;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STATUS_WORDS: Record<string, ContactStatus> = {
  lead: 'new', subscriber: 'new', open: 'new',
  'in progress': 'contacted', 'follow up': 'contacted',
  sql: 'qualified', mql: 'qualified', opportunity: 'qualified',
  won: 'customer', client: 'customer', paying: 'customer',
  'closed lost': 'lost', unqualified: 'lost', churned: 'lost',
};

/** A status cell as one of ours; unknown words leave the status unset rather than failing the row. */
export function normaliseStatus(value: string): ContactStatus | undefined {
  const v = value.trim().toLowerCase();
  if (!v) return undefined;
  if ((CONTACT_STATUSES as readonly string[]).includes(v)) return v as ContactStatus;
  return STATUS_WORDS[v];
}

/** Tags separated by semicolons, commas or pipes, trimmed, de-duplicated, lower-cased. */
export function splitTags(value: string): string[] {
  return [...new Set(value.split(/[;,|]/).map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 20);
}

export type PreparedImport = { rows: ImportRow[]; invalid: { row: number; reason: string }[]; duplicates: number };

/**
 * The data rows (header excluded) as contacts. `row` numbers in `invalid` count the header as
 * line 1, as a spreadsheet shows them. A repeated email keeps its first row.
 */
export function prepareImport(dataRows: string[][], mapping: ColumnMapping): PreparedImport {
  const cell = (r: string[], field: ImportField) => (mapping[field] >= 0 ? (r[mapping[field]] ?? '').trim() : '');
  const seen = new Set<string>();
  const out: PreparedImport = { rows: [], invalid: [], duplicates: 0 };
  dataRows.forEach((r, i) => {
    const line = i + 2;
    const email = cell(r, 'email').toLowerCase();
    if (!email) { out.invalid.push({ row: line, reason: 'No email' }); return; }
    if (!EMAIL.test(email) || email.length > 254) { out.invalid.push({ row: line, reason: `Not an email address: ${email}` }); return; }
    if (seen.has(email)) { out.duplicates++; return; }
    seen.add(email);
    const row: ImportRow = { email };
    const name = cell(r, 'name').slice(0, 200);
    const phone = cell(r, 'phone').slice(0, 50);
    const notes = cell(r, 'notes').slice(0, 5000);
    const status = normaliseStatus(cell(r, 'status'));
    const tags = splitTags(cell(r, 'tags'));
    if (name) row.name = name;
    if (phone) row.phone = phone;
    if (notes) row.notes = notes;
    if (status) row.status = status;
    if (tags.length) row.tags = tags;
    out.rows.push(row);
  });
  return out;
}
