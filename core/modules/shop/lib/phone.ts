/**
 * Bangladeshi mobile numbers, as buyers type them: "+880 1711-000000", "8801711000000",
 * "01711000000", Bangla digits included. Stored as the 11 local digits, 01XXXXXXXXX.
 */

const BANGLA_DIGITS = "০১২৩৪৫৬৭৮৯";

/** The number as 01XXXXXXXXX, or null when it is not a Bangladeshi mobile number. */
export function normalizeBdPhone(raw: string): string | null {
  const latin = raw.replace(/[০-৯]/g, (d) => String(BANGLA_DIGITS.indexOf(d)));
  let digits = latin.replace(/[\s\-().]/g, "");
  if (!/^\+?\d+$/.test(digits)) return null;
  digits = digits.replace(/^\+/, "");
  if (digits.startsWith("880")) digits = `0${digits.slice(3)}`;
  else if (digits.startsWith("88")) digits = digits.slice(2);
  // Operators' prefixes: 013 to 019.
  return /^01[3-9]\d{8}$/.test(digits) ? digits : null;
}

/** 01XXXXXXXXX as E.164 digits without the plus, 8801XXXXXXXXX: what ad platforms hash. */
export const e164Digits = (local: string): string => `88${local}`;
