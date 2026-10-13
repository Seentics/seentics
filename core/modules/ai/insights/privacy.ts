/**
 * Keeping personal data out of what is stored and what is sent to a model.
 *
 * A page path can carry an id or an email (`/users/ada@example.com`, `/orders/884213`), and
 * an error message can quote whatever the code was handling. Both are reduced to their shape:
 * the page keeps its route, the message keeps its words, and anything that identifies a person
 * or a record is replaced by a placeholder. This is applied once, when the snapshot is read, so
 * nothing downstream ever holds the original.
 */

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;
const IPV4 = /\b\d{1,3}(?:\.\d{1,3}){3}\b/g;
const TOKEN = /\b(?:eyJ[A-Za-z0-9_-]{8,}|[A-Za-z0-9_-]{32,})\b/g;
const BEARER = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const LONG_DIGITS = /\b\d{6,}\b/g;
/** Three groups of digits with separators, so a date (2026-10-13) or a figure (1,240) is not taken for a number to ring. */
const PHONE = /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)|\d{2,4})[\s.-]\d{3,4}[\s.-]\d{3,4}\b/g;

/** A route with its query string and fragment dropped, and ids in its segments masked. */
export function maskPath(raw: string | null | undefined): string {
  if (!raw) return '/';
  let path = String(raw);
  // A full URL is reduced to its path.
  path = path.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]+/i, '');
  path = path.split('#')[0]!.split('?')[0]!;
  if (!path.startsWith('/')) path = `/${path}`;
  const masked = path
    .split('/')
    .map((segment) => {
      if (!segment) return segment;
      let s = decodeSegment(segment);
      if (EMAIL.test(s)) { EMAIL.lastIndex = 0; return ':email'; }
      EMAIL.lastIndex = 0;
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(s) || /^\d{4,}$/.test(s) || /^[0-9a-f]{16,}$/i.test(s)) return ':id';
      return s.slice(0, 60);
    })
    .join('/');
  return masked.length > 1 ? masked.replace(/\/+$/, '') || '/' : '/';
}

function decodeSegment(segment: string): string {
  try { return decodeURIComponent(segment); } catch { return segment; }
}

/** Free text with anything that identifies a person or a credential replaced, and a length limit. */
export function maskText(raw: string | null | undefined, max = 140): string {
  if (!raw) return '';
  return String(raw)
    .replace(EMAIL, '[email]')
    .replace(UUID, '[id]')
    .replace(BEARER, 'Bearer [token]')
    .replace(IPV4, '[ip]')
    .replace(TOKEN, '[token]')
    .replace(PHONE, '[number]')
    .replace(LONG_DIGITS, '[number]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/** Whether text still contains something that looks like personal data: the last check on a model's output. */
export function looksPersonal(text: string): boolean {
  const found = EMAIL.test(text) || IPV4.test(text) || PHONE.test(text) || UUID.test(text);
  EMAIL.lastIndex = IPV4.lastIndex = PHONE.lastIndex = UUID.lastIndex = 0;
  return found;
}
