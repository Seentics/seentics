import {
  COLLECT_FEATURES,
  DASHBOARD_FEATURES,
  type Client,
  type ClientListFilter,
  type ClientRepository,
  type CreateClientInput,
  type CursorPage,
  type Page,
  type UpdateClientInput,
  type Website,
  type WebsiteListFilter,
} from "../../../websites/interfaces";
import type {
  AgencyAlert,
  AlertRepository,
  MetricTotals,
  MetricWindow,
  OverviewMetric,
  SetupSignalRepository,
  SiteMetricSource,
  TrackingActivity,
  TrackingActivityReader,
  WhiteLabelRepository,
  WhiteLabelSettings,
} from "../../interfaces";

/**
 * In-memory stand-ins for everything the agency API reads and writes, so its routes run
 * against the real services (ClientService, the overview, setup and verification) with no
 * database. Import after the `db`, `logger` and `config` mocks are installed.
 */

let seq = 0;
export const uuid = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, "0")}`;
/** A strictly increasing clock, so newest-first order is deterministic. */
const tick = () => new Date(Date.UTC(2026, 9, 1) + ++seq * 1000);

export function makeSite(ownerId: string, over: Partial<Website> = {}): Website {
  const at = tick();
  return {
    id: uuid(), ownerId, name: "site", url: "site.example", trackingId: "trk", isActive: true, isVerified: false,
    automationEnabled: true, funnelEnabled: true, errorsEnabled: true, heatmapEnabled: true,
    heatmapIncludePatterns: null, heatmapExcludePatterns: null, heatmapLayoutEnabled: true,
    replayEnabled: true, replaySamplingRate: 1, replayIncludePatterns: null, replayExcludePatterns: null,
    maskAllText: false, maskTextPatterns: null, verificationToken: "v", publicShareId: null, clientId: null,
    settings: {} as Website["settings"], createdAt: at, updatedAt: at, ...over,
  };
}

function newestFirst<T extends { createdAt: Date; id: string }>(rows: T[], page: CursorPage): T[] {
  return rows
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : -1))
    .filter((r) => !page.after || r.createdAt < page.after.createdAt || (r.createdAt.getTime() === page.after.createdAt.getTime() && r.id < page.after.id))
    .slice(0, page.limit);
}

export class MemoryClients implements ClientRepository {
  clients = new Map<string, Client>();
  constructor(readonly sites: Map<string, Website>) {}

  async create(ownerId: string, input: CreateClientInput): Promise<Client> {
    const at = tick();
    const c: Client = {
      id: uuid(), ownerId, name: input.name, company: input.company ?? "", notes: input.notes ?? "", status: input.status ?? "active",
      collectFeatures: Object.fromEntries(COLLECT_FEATURES.map((f) => [f, input.collectFeatures?.[f] !== false])) as Client["collectFeatures"],
      dashboardFeatures: Object.fromEntries(DASHBOARD_FEATURES.map((f) => [f, "off"])) as Client["dashboardFeatures"],
      createdAt: at, updatedAt: at,
    };
    this.clients.set(c.id, c);
    return c;
  }
  async findById(id: string) { return this.clients.get(id) ?? null; }
  async list(ownerId: string, f: ClientListFilter, page: CursorPage) {
    return newestFirst([...this.clients.values()].filter((c) =>
      c.ownerId === ownerId && (!f.status || c.status === f.status) && (!f.q || `${c.name} ${c.company}`.toLowerCase().includes(f.q.toLowerCase()))), page);
  }
  async update(id: string, input: UpdateClientInput) {
    const c = this.clients.get(id);
    if (!c) return null;
    const next: Client = {
      ...c,
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.company !== undefined ? { company: input.company } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      collectFeatures: { ...c.collectFeatures, ...(input.collectFeatures ?? {}) } as Client["collectFeatures"],
      dashboardFeatures: input.dashboardFeatures
        ? ({ ...Object.fromEntries(DASHBOARD_FEATURES.map((f) => [f, "off"])), ...input.dashboardFeatures } as Client["dashboardFeatures"])
        : c.dashboardFeatures,
      updatedAt: new Date(),
    };
    this.clients.set(id, next);
    return next;
  }
  async delete(id: string) {
    for (const s of this.sites.values()) if (s.clientId === id) s.clientId = null;
    return this.clients.delete(id);
  }
  async listWebsites(ownerId: string, f: { clientId?: string } & Page) {
    return [...this.sites.values()].filter((s) => s.ownerId === ownerId && (!f.clientId || s.clientId === f.clientId)).slice(f.offset, f.offset + f.limit);
  }
  async pageWebsites(ownerId: string, f: WebsiteListFilter, page: CursorPage) {
    return newestFirst([...this.sites.values()].filter((s) =>
      s.ownerId === ownerId &&
      (f.unassigned ? s.clientId === null : !f.clientId || s.clientId === f.clientId) &&
      (!f.q || `${s.name} ${s.url}`.includes(f.q))), page);
  }
  async allWebsites(ownerId: string) { return [...this.sites.values()].filter((s) => s.ownerId === ownerId); }
  async websitesOfClients(ids: string[]) { return [...this.sites.values()].filter((s) => s.clientId !== null && ids.includes(s.clientId)); }
  async markVerified(id: string) {
    const s = this.sites.get(id);
    if (!s || s.isVerified) return false;
    s.isVerified = true;
    return true;
  }
}

/** The website writes `ClientService` takes, over the same site map. */
export function memorySiteWrites(sites: Map<string, Website>, deleted: string[] = []) {
  return {
    reads: { findById: async (id: string) => sites.get(id) ?? null },
    writes: {
      create: async (ownerId: string, input: { name: string; url: string; clientId?: string | null }) => {
        const s = makeSite(ownerId, { name: input.name, url: input.url.replace(/^https?:\/\//, ""), clientId: input.clientId ?? null });
        sites.set(s.id, s);
        return s;
      },
      update: async (id: string, input: { name?: string; url?: string; clientId?: string | null }) => {
        const s = sites.get(id);
        if (!s) return null;
        if (input.name !== undefined) s.name = input.name;
        if (input.url !== undefined) s.url = input.url;
        if (input.clientId !== undefined) s.clientId = input.clientId;
        return s;
      },
      delete: async (id: string) => {
        deleted.push(id);
        return sites.delete(id);
      },
    },
  };
}

/** One row per owner; a slug another owner holds is refused, as the unique index would. */
export class MemoryWhiteLabel implements WhiteLabelRepository {
  rows = new Map<string, WhiteLabelSettings>();
  async find(ownerId: string) { return this.rows.get(ownerId) ?? null; }
  async upsert(s: WhiteLabelSettings) {
    if (s.slug && [...this.rows.values()].some((r) => r.slug === s.slug && r.ownerId !== s.ownerId)) return "slug_taken" as const;
    const saved = { ...s, updatedAt: new Date() };
    this.rows.set(s.ownerId, saved);
    return saved;
  }
}

export class MemoryAlerts implements AlertRepository {
  rows: AgencyAlert[] = [];
  add(ownerId: string, over: Partial<AgencyAlert> = {}): AgencyAlert {
    const a: AgencyAlert = { id: uuid(), ownerId, clientId: null, websiteId: null, kind: "tracking_stopped", resource: "", period: "2026-10-16", createdAt: tick(), dismissedAt: null, ...over };
    this.rows.push(a);
    return a;
  }
  async listOpen(ownerId: string, limit: number) {
    return this.rows.filter((a) => a.ownerId === ownerId && !a.dismissedAt).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, limit);
  }
  async dismiss(ownerId: string, id: string) {
    const a = this.rows.find((r) => r.id === id && r.ownerId === ownerId);
    if (!a) return null;
    a.dismissedAt ??= new Date();
    return a;
  }
}

export class MemorySignals implements SetupSignalRepository {
  members = new Set<string>();
  domains = new Map<string, { hostname: string; state: string }>();
  async hasClientMember(ownerId: string) { return this.members.has(ownerId); }
  async customDomain(ownerId: string) { return this.domains.get(ownerId) ?? null; }
}

/** Figures per site, per window, set by the test. */
export class FixedMetrics implements SiteMetricSource {
  readonly byWindow = new Map<string, Map<string, MetricTotals>>();
  calls: { ids: readonly string[]; window: MetricWindow }[] = [];
  fail = false;
  constructor(readonly metrics: readonly OverviewMetric[]) {}
  set(window: MetricWindow, siteId: string, totals: MetricTotals) {
    const key = `${window.from}..${window.to}`;
    if (!this.byWindow.has(key)) this.byWindow.set(key, new Map());
    this.byWindow.get(key)!.set(siteId, totals);
  }
  async totalsBySite(ids: readonly string[], window: MetricWindow) {
    this.calls.push({ ids, window });
    if (this.fail) throw new Error("source down");
    const all = this.byWindow.get(`${window.from}..${window.to}`) ?? new Map();
    return new Map([...all].filter(([id]) => ids.includes(id)));
  }
}

export class FixedActivity implements TrackingActivityReader {
  bySite = new Map<string, TrackingActivity>();
  async activity(ids: readonly string[]) {
    return new Map([...this.bySite].filter(([id]) => ids.includes(id)));
  }
}
