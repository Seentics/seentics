/** Mirrors Go `ParseUserAgent` device bucket: mobile | tablet | desktop | Unknown */
export function deviceTypeFromUA(ua: string): string {
  const s = (ua ?? "").trim();
  if (!s) return "Unknown";
  const lower = s.toLowerCase();
  if (/mobile|iphone|ipod|android.*mobile|webos|blackberry|opera mini|iemobile/i.test(lower)) {
    if (/tablet|ipad/i.test(lower)) return "tablet";
    return "mobile";
  }
  if (/tablet|ipad/i.test(lower)) return "tablet";
  return "desktop";
}
