import { MemoryCache } from "../../../platform/cache/memory-cache";
import { log } from "../../../platform/observability/logger";
import type { ClientDirectory, ClientWithWebsites, OwnedWebsites, Website } from "../../websites/interfaces";
import type {
  AgencyAlert,
  AgencyOverview,
  AgencyOverviewReader,
  AlertRepository,
  ClientOverviewRow,
  MetricTotals,
  MetricWindow,
  Mover,
  OverviewMetric,
  OverviewPeriod,
  SiteMetricSource,
} from "../interfaces";

const overview_log = log.child({ category: "agency" });

const PERIOD_DAYS: Record<OverviewPeriod, number> = { "7d": 7, "30d": 30, "90d": 90 };
const CACHE_TTL_MS = 60_000;
const MOVERS = 5;
const ALERTS = 50;
/** Page size when walking every client; the overview needs them all. */
const CLIENT_PAGE = 100;
const DAY_MS = 86_400_000;

/** The period's UTC days ending today, and the same number of days before it. */
export function periodWindows(period: OverviewPeriod, now = Date.now()): { current: MetricWindow; previous: MetricWindow } {
  const days = PERIOD_DAYS[period];
  const today = Date.parse(new Date(now).toISOString().slice(0, 10) + "T00:00:00Z");
  const day = (offset: number) => new Date(today + offset * DAY_MS).toISOString().slice(0, 10);
  return {
    current: { from: day(-(days - 1)), to: day(0) },
    previous: { from: day(-(2 * days - 1)), to: day(-days) },
  };
}

/** Every client the owner has, a page at a time. */
export async function allClients(clients: ClientDirectory, ownerId: string): Promise<ClientWithWebsites[]> {
  const out: ClientWithWebsites[] = [];
  let after: { createdAt: Date; id: string } | undefined;
  for (;;) {
    const page = await clients.listClients(ownerId, {}, { limit: CLIENT_PAGE, after });
    out.push(...page.items);
    const last = page.items[page.items.length - 1];
    if (!page.hasMore || !last) return out;
    after = { createdAt: last.createdAt, id: last.id };
  }
}

function add(into: MetricTotals, from: MetricTotals | undefined): void {
  if (!from) return;
  for (const [k, v] of Object.entries(from) as [OverviewMetric, number][]) into[k] = (into[k] ?? 0) + v;
}

/** Zero for every metric some source counted, so a quiet client reads 0 rather than "unknown". */
function zeroes(metrics: Set<OverviewMetric>): MetricTotals {
  return Object.fromEntries([...metrics].map((m) => [m, 0])) as MetricTotals;
}

/**
 * The agency overview: every site the agency has, totalled per client and overall, for a
 * period and the one before it, with the sites that moved most and the open alerts.
 *
 * Each module counts its own rows through `SiteMetricSource`, one batched read per source
 * per window. A source that fails leaves its metrics out of the answer (and is logged)
 * rather than failing the page: one module's outage should not blank the other numbers.
 *
 * Cached a minute per owner and period — the page is the agency's landing screen and its
 * reads span every site the agency has.
 */
export class AgencyOverviewService implements AgencyOverviewReader {
  private readonly cache = new MemoryCache<AgencyOverview>(2_000);

  constructor(
    private readonly deps: {
      clients: ClientDirectory;
      websites: OwnedWebsites;
      sources: readonly SiteMetricSource[];
      alerts: AlertRepository;
      now?: () => number;
    },
  ) {}

  async overview(ownerId: string, period: OverviewPeriod): Promise<AgencyOverview> {
    const key = `${ownerId}:${period}`;
    const hit = this.cache.get(key);
    if (hit) return hit;
    const fresh = await this.compute(ownerId, period);
    this.cache.set(key, fresh, CACHE_TTL_MS);
    return fresh;
  }

  async dismissAlert(ownerId: string, alertId: string): Promise<AgencyAlert | null> {
    const alert = await this.deps.alerts.dismiss(ownerId, alertId);
    // The cached overview lists the alert; drop the owner's entries so it goes at once.
    if (alert) for (const p of Object.keys(PERIOD_DAYS)) this.cache.delete(`${ownerId}:${p}`);
    return alert;
  }

  private async compute(ownerId: string, period: OverviewPeriod): Promise<AgencyOverview> {
    const now = this.deps.now?.() ?? Date.now();
    const windows = periodWindows(period, now);
    const [sites, clients, alerts] = await Promise.all([
      this.deps.websites.allWebsites(ownerId),
      allClients(this.deps.clients, ownerId),
      this.deps.alerts.listOpen(ownerId, ALERTS),
    ]);
    const ids = sites.map((s) => s.id);
    const [current, previous] = await Promise.all([this.collect(ids, windows.current), this.collect(ids, windows.previous)]);
    const counted = new Set([...current.metrics].filter((m) => previous.metrics.has(m)));

    const sum = (list: Website[], perSite: Map<string, MetricTotals>) => {
      const t = zeroes(counted);
      for (const s of list) add(t, pick(perSite.get(s.id), counted));
      return t;
    };

    const rows: ClientOverviewRow[] = clients.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      websiteCount: c.websites.length,
      totals: sum(c.websites, current.bySite),
      previous: sum(c.websites, previous.bySite),
    }));
    const loose = sites.filter((s) => s.clientId === null);
    if (loose.length > 0) {
      rows.push({ id: null, name: "Unassigned", status: null, websiteCount: loose.length, totals: sum(loose, current.bySite), previous: sum(loose, previous.bySite) });
    }

    return {
      period,
      window: windows.current,
      previousWindow: windows.previous,
      totals: sum(sites, current.bySite),
      previous: sum(sites, previous.bySite),
      clients: rows,
      movers: counted.has("visitors") ? movers(sites, current.bySite, previous.bySite) : [],
      alerts,
      generatedAt: new Date(now),
    };
  }

  /** Every source's figures for one window, merged per site. */
  private async collect(ids: string[], window: MetricWindow): Promise<{ bySite: Map<string, MetricTotals>; metrics: Set<OverviewMetric> }> {
    const bySite = new Map<string, MetricTotals>();
    const metrics = new Set<OverviewMetric>();
    if (ids.length === 0) {
      for (const s of this.deps.sources) for (const m of s.metrics) metrics.add(m);
      return { bySite, metrics };
    }
    const results = await Promise.allSettled(this.deps.sources.map((s) => s.totalsBySite(ids, window)));
    results.forEach((r, i) => {
      const source = this.deps.sources[i]!;
      if (r.status === "rejected") {
        overview_log.error({ msg: "agency_overview_source_failed", metrics: source.metrics, err: String(r.reason) });
        return;
      }
      for (const m of source.metrics) metrics.add(m);
      for (const [siteId, t] of r.value) bySite.set(siteId, { ...bySite.get(siteId), ...pick(t, new Set(source.metrics)) });
    });
    return { bySite, metrics };
  }
}

function pick(t: MetricTotals | undefined, keep: Set<OverviewMetric>): MetricTotals {
  if (!t) return {};
  return Object.fromEntries(Object.entries(t).filter(([k]) => keep.has(k as OverviewMetric))) as MetricTotals;
}

/** The sites whose visitors changed most, either way, against the previous period. */
function movers(sites: Website[], current: Map<string, MetricTotals>, previous: Map<string, MetricTotals>): Mover[] {
  return sites
    .map((s) => {
      const cur = current.get(s.id)?.visitors ?? 0;
      const prev = previous.get(s.id)?.visitors ?? 0;
      return {
        websiteId: s.id,
        websiteName: s.name,
        clientId: s.clientId,
        metric: "visitors" as const,
        current: cur,
        previous: prev,
        changePct: prev > 0 ? Math.round(((cur - prev) / prev) * 1000) / 10 : null,
      };
    })
    .filter((m) => m.current !== m.previous)
    .sort((a, b) => Math.abs(b.current - b.previous) - Math.abs(a.current - a.previous))
    .slice(0, MOVERS);
}
