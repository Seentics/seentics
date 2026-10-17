import { describe, expect, it } from 'vitest';
import {
  DEMO_AGENCY_POOL,
  demoAgencyAlerts,
  demoAgencyClient,
  demoAgencyClientUsage,
  demoAgencyClients,
  demoAgencyEmbeds,
  demoAgencyInstall,
  demoAgencyOverview,
  demoAgencyResponse,
  demoAgencyUsage,
  demoAgencyWebsiteUsage,
  demoAgencyWebsites,
} from '../agency';

describe('agency demo fixtures', () => {
  it('eight clients, one archived, each with 1-4 websites, and two unassigned sites', () => {
    const clients = demoAgencyClients();
    const sites = demoAgencyWebsites();
    expect(clients).toHaveLength(8);
    expect(clients.filter(c => c.status === 'archived').map(c => c.name)).toEqual(['Old Client Ltd']);
    for (const c of clients) {
      const own = sites.filter(w => w.client_id === c.id);
      expect(own.length, c.name).toBe(c.website_count);
      expect(own.length).toBeGreaterThanOrEqual(1);
      expect(own.length).toBeLessThanOrEqual(4);
    }
    expect(sites.filter(w => w.client_id === null)).toHaveLength(2);
    expect(new Set(sites.map(w => w.id)).size).toBe(sites.length);
  });

  it('usage adds up: pool totals = client rows = website rows, against the Agency pool', () => {
    const usage = demoAgencyUsage();
    expect(usage.pool).toEqual(DEMO_AGENCY_POOL);
    expect(usage.used.events).toBe(6_200_000);
    expect(usage.used.recordings).toBe(12_000);
    const websites = demoAgencyWebsiteUsage();
    const clients = demoAgencyClientUsage();
    for (const r of ['events', 'recordings', 'leads', 'ai_analyses'] as const) {
      expect(websites.reduce((n, w) => n + w.used[r], 0)).toBe(usage.used[r]);
      const unassigned = websites.filter(w => w.client_id === null).reduce((n, w) => n + w.used[r], 0);
      expect(clients.reduce((n, c) => n + c.used[r], 0) + unassigned).toBe(usage.used[r]);
      expect(usage.allocated[r] + usage.unallocated[r]).toBe(usage.pool[r]);
    }
  });

  it('the alerts are explained by the figures', () => {
    const rows = new Map(demoAgencyClientUsage().map(r => [r.id, r]));
    const kinds = demoAgencyAlerts().map(a => a.kind).sort();
    expect(kinds).toEqual(['cap_100', 'cap_80', 'tracking_stopped']);
    expect(rows.get('cl_acme')!.pct.events).toBeGreaterThanOrEqual(80);
    expect(rows.get('cl_acme')!.pct.events).toBeLessThan(100);
    expect(rows.get('cl_harbor')!.pct.events).toBe(100);
    const stopped = demoAgencyAlerts().find(a => a.kind === 'tracking_stopped')!;
    expect(demoAgencyInstall(stopped.website_id!)!.verification.status).toBe('stale');
  });

  it('installs: one stale, one never seen, the rest receiving', () => {
    const statuses = demoAgencyWebsites().map(w => demoAgencyInstall(w.id)!.verification.status);
    expect(statuses.filter(s => s === 'stale')).toHaveLength(1);
    expect(statuses.filter(s => s === 'not_seen')).toHaveLength(1);
  });

  it('the overview totals are the sum of its client rows, with movers both ways', () => {
    const o = demoAgencyOverview('30d');
    expect(o.clients.reduce((n, c) => n + (c.totals.visitors ?? 0), 0)).toBe(o.totals.visitors);
    expect(o.top_movers.some(m => (m.change_pct ?? 0) > 0)).toBe(true);
    expect(o.top_movers.some(m => (m.change_pct ?? 0) < 0)).toBe(true);
    expect(o.alerts).toHaveLength(3);
  });

  it('embeds point at real clients and websites', () => {
    const ids = new Set([...demoAgencyClients().map(c => c.id), ...demoAgencyWebsites().map(w => w.id)]);
    for (const e of demoAgencyEmbeds()) expect(ids.has(e.target_id)).toBe(true);
  });

  it('answers api.ts paths with the wire envelope, filtered as the API filters', () => {
    expect((demoAgencyResponse('/agency/clients', { query: { status: 'archived' } }) as { data: unknown[] }).data).toHaveLength(1);
    expect((demoAgencyResponse('/agency/websites', { query: { unassigned: true } }) as { data: unknown[] }).data).toHaveLength(2);
    expect((demoAgencyResponse('/agency/clients/:id', { params: { id: 'cl_nova' } }) as { data: unknown }).data).toEqual(demoAgencyClient('cl_nova'));
    expect(() => demoAgencyResponse('/agency/clients/:id', { params: { id: 'nope' } })).toThrow();
  });
});
