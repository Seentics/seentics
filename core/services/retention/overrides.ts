import type { AppConfig } from "../../config";

/** Optional per-website overrides when remote retention API is configured (`website_id` = core `websites.id`). */
export type WebsiteRetentionOverride = {
  website_id: string;
  analytics_days?: number;
  replay_days?: number;
  heatmap_days?: number;
  funnel_automation_days?: number;
  temp_data_hours?: number;
};

type EnterpriseRetentionResponse = {
  websites?: WebsiteRetentionOverride[];
};

function optDays(n: unknown, max = 3650): number | undefined {
  if (typeof n !== "number" || !Number.isFinite(n)) return undefined;
  const x = Math.floor(n);
  if (x < 1) return undefined;
  return Math.min(x, max);
}

function optHours(n: unknown): number | undefined {
  if (typeof n !== "number" || !Number.isFinite(n)) return undefined;
  const x = Math.floor(n);
  if (x < 1) return undefined;
  return Math.min(x, 24 * 365);
}

/** Fetch overrides from configured URL; on failure returns empty map (defaults apply). */
export async function fetchRetentionOverrides(cfg: AppConfig): Promise<Map<string, WebsiteRetentionOverride>> {
  const out = new Map<string, WebsiteRetentionOverride>();
  if (!cfg.dataRetention.enterpriseEnabled || !cfg.dataRetention.enterpriseRetentionUrl) {
    return out;
  }
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), Math.max(5000, cfg.dataRetention.enterpriseFetchTimeoutMs));
    const res = await fetch(cfg.dataRetention.enterpriseRetentionUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(cfg.globalApiKey ? { "X-API-Key": cfg.globalApiKey } : {}),
      },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) {
      console.warn("retention overrides fetch failed", res.status);
      return out;
    }
    const body = (await res.json()) as EnterpriseRetentionResponse;
    const list = Array.isArray(body.websites) ? body.websites : [];
    for (const w of list) {
      const id = typeof w.website_id === "string" ? w.website_id.trim() : "";
      if (!id) continue;
      const row: WebsiteRetentionOverride = { website_id: id };
      const ad = optDays(w.analytics_days);
      const rd = optDays(w.replay_days);
      const hd = optDays(w.heatmap_days);
      const fd = optDays(w.funnel_automation_days);
      const th = optHours(w.temp_data_hours);
      if (ad != null) row.analytics_days = ad;
      if (rd != null) row.replay_days = rd;
      if (hd != null) row.heatmap_days = hd;
      if (fd != null) row.funnel_automation_days = fd;
      if (th != null) row.temp_data_hours = th;
      out.set(id, row);
    }
  } catch (e) {
    console.warn("retention overrides fetch error", e);
  }
  return out;
}
