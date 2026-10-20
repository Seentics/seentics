import { utmOf } from "./utm";

/**
 * The site a lead came from, by name, for the leads page's "where they came from": the UTM source
 * when the link carries one, else the referring site. The many spellings of the big ones are one
 * name ("fb", "m.facebook.com", "l.facebook.com" → facebook), so the page can show their logos;
 * anything else is its host without "www.". Null for a visit with neither (typed in, a bookmark).
 */
const KNOWN: [RegExp, string][] = [
  [/^(fb|facebook|meta)$|(^|\.)facebook\.com$|(^|\.)fb\.com$|^fb\.me$/, "facebook"],
  [/^(ig|instagram)$|(^|\.)instagram\.com$/, "instagram"],
  [/^google$|(^|\.)google\.[a-z.]+$|^googleads|^adwords$/, "google"],
  [/^(yt|youtube)$|(^|\.)youtube\.com$|^youtu\.be$/, "youtube"],
  [/^tiktok$|(^|\.)tiktok\.com$/, "tiktok"],
  [/^(twitter|x)$|(^|\.)twitter\.com$|^x\.com$|^t\.co$/, "x"],
  [/^linkedin$|(^|\.)linkedin\.com$|^lnkd\.in$/, "linkedin"],
  [/^(whatsapp|wa)$|(^|\.)whatsapp\.com$|^wa\.me$/, "whatsapp"],
  [/^messenger$|(^|\.)messenger\.com$|^m\.me$/, "messenger"],
  [/^bing$|(^|\.)bing\.com$/, "bing"],
];

export function sourceOf(pageUrl: string, referrer: string): string | null {
  const utm = utmOf(pageUrl).source?.toLowerCase().trim() || null;
  let host: string | null = null;
  if (!utm && referrer) {
    try { host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, ""); } catch { host = null; }
  }
  const raw = utm ?? host;
  if (!raw) return null;
  for (const [pattern, name] of KNOWN) if (pattern.test(raw)) return name;
  return raw.slice(0, 100);
}
