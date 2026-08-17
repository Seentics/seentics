export function pickStr(m: Record<string, unknown> | undefined, keys: string[]): string | undefined {
  if (!m) return undefined;
  for (const k of keys) {
    const v = m[k];
    if (typeof v === "string" && v) return v;
  }
  return undefined;
}

export function pickInt(m: Record<string, unknown> | undefined, keys: string[]): number | undefined {
  if (!m) return undefined;
  for (const k of keys) {
    const v = m[k];
    if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  }
  return undefined;
}

/** Tracker sends `utm: { source, medium, campaign }` from URL params; also accept flat utm_* on `data`. */
export function pickUtmColumns(dm: Record<string, unknown> | undefined): {
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
} {
  let utmSource = pickStr(dm, ["utm_source", "utmSource"]) ?? null;
  let utmMedium = pickStr(dm, ["utm_medium", "utmMedium"]) ?? null;
  let utmCampaign = pickStr(dm, ["utm_campaign", "utmCampaign"]) ?? null;
  const nested = dm?.utm;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const u = nested as Record<string, unknown>;
    utmSource = utmSource ?? pickStr(u, ["source", "utm_source", "utmSource"]) ?? null;
    utmMedium = utmMedium ?? pickStr(u, ["medium", "utm_medium", "utmMedium"]) ?? null;
    utmCampaign = utmCampaign ?? pickStr(u, ["campaign", "utm_campaign", "utmCampaign"]) ?? null;
  }
  return { utmSource, utmMedium, utmCampaign };
}
