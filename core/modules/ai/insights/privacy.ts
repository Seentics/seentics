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

/** A segment after one of these names a person, a record or a credential, whatever it looks like. */
const SECRET_PREFIXES = new Set(['reset', 'verify', 'invite', 'token', 'u', 'user', 'users']);

/**
 * Looks generated rather than written: 8+ letters and digits only, with at least two digits, and
 * letters and digits interleaved (`a8F3kd92`, `x7Kq9pLm`), or mixed case with digits at 12+. A slug
 * that ends in a number (`iphone15`, `top10-tips`) or a version (`v2`) is left alone.
 */
function looksRandom(s: string): boolean {
  if (s.length < 8 || !/^[A-Za-z0-9]+$/.test(s)) return false;
  const digits = s.replace(/\D/g, '').length;
  if (digits < 2 || digits === s.length) return false;
  const switches = (s.match(/[A-Za-z](?=\d)|\d(?=[A-Za-z])/g) ?? []).length;
  if (switches >= 3) return true;
  return s.length >= 12 && /[a-z]/.test(s) && /[A-Z]/.test(s);
}

/**
 * A credential or generated id. The text rule for tokens (32+ word characters) alone would also take
 * a long, hyphenated blog slug, so in a path it needs one of its parts to look generated as well.
 */
function looksSecret(s: string): boolean {
  if (/^eyJ[A-Za-z0-9_-]{8,}/.test(s)) return true;
  const parts = s.split(/[-_]/);
  if (parts.some(looksRandom)) return true;
  return matches(TOKEN, s) && parts.some((p) => (p.length >= 16 && /\d/.test(p)) || p.length >= 32);
}

/** Whether `re` (a global regex) matches `s`, without leaving its `lastIndex` behind. */
function matches(re: RegExp, s: string): boolean {
  re.lastIndex = 0;
  const found = re.test(s);
  re.lastIndex = 0;
  return found;
}

/** A route with its query string and fragment dropped, and ids, tokens and numbers in its segments masked. */
export function maskPath(raw: string | null | undefined): string {
  if (!raw) return '/';
  let path = String(raw);
  // A full URL is reduced to its path.
  path = path.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]+/i, '');
  path = path.split('#')[0]!.split('?')[0]!;
  if (!path.startsWith('/')) path = `/${path}`;
  let previous = '';
  const masked = path
    .split('/')
    .map((segment) => {
      if (!segment) return segment;
      const s = decodeSegment(segment);
      const after = previous;
      previous = s.toLowerCase();
      if (matches(EMAIL, s)) return ':email';
      if (SECRET_PREFIXES.has(after)) return ':id';
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(s) || /^\d{4,}$/.test(s) || /^[0-9a-f]{16,}$/i.test(s)) return ':id';
      if (looksSecret(s) || matches(PHONE, s) || matches(LONG_DIGITS, s)) return ':id';
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
