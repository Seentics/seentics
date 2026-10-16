/** The UTM parameters on a page URL, or nulls when it has none or does not parse. */
export function utmOf(pageUrl: string): { source: string | null; medium: string | null; campaign: string | null } {
  try {
    const params = new URL(pageUrl).searchParams;
    const get = (k: string) => params.get(k)?.trim() || null;
    return { source: get("utm_source"), medium: get("utm_medium"), campaign: get("utm_campaign") };
  } catch {
    return { source: null, medium: null, campaign: null };
  }
}
