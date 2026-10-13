import { describe, expect, it } from 'vitest';
import { demoAutomations } from '@/lib/demo';
import { demoContact, demoContacts, demoLeadStats } from '@/lib/demo/leads';
import { demoDeliveries, demoProviders } from '@/lib/demo/integrations';
import { leadsApi } from '@/features/leads/api';
import { integrationsApi } from '@/features/integrations/api';

const ALL = { search: '', status: '' as const, limit: 100, offset: 0 };

describe('demo leads', () => {
  it('is stable across calls and uses only reserved example.com addresses', () => {
    expect(demoContacts(ALL)).toEqual(demoContacts(ALL));
    for (const c of demoContacts(ALL).contacts) expect(c.email.endsWith('@example.com')).toBe(true);
  });

  it('lists newest activity first and filters like the real endpoint', () => {
    const all = demoContacts(ALL).contacts;
    expect([...all].sort((a, b) => b.last_submitted_at.localeCompare(a.last_submitted_at))).toEqual(all);
    expect(demoContacts({ ...ALL, status: 'archived' }).contacts.every((c) => c.status === 'archived')).toBe(true);
    expect(demoContacts({ ...ALL, search: 'AVA' }).contacts.map((c) => c.name)).toEqual(['Ava Martin']);
    const page = demoContacts({ ...ALL, limit: 5, offset: 5 });
    expect(page.contacts).toHaveLength(5);
    expect(page.total).toBe(all.length);
  });

  it('gives every contact a detail view whose submissions match its count and point at real demo popups', () => {
    const popupIds = new Set(demoAutomations().automations.map((a) => a.id));
    for (const c of demoContacts(ALL).contacts) {
      const detail = demoContact(c.id)!;
      expect(detail.submissions).toHaveLength(c.submission_count);
      for (const s of detail.submissions) expect(popupIds.has(s.automation_id!)).toBe(true);
    }
    expect(demoContact('missing')).toBeNull();
  });

  it('reports stats that agree with the list', () => {
    const stats = demoLeadStats();
    expect(stats.total).toBe(demoContacts(ALL).total);
    expect(stats.by_automation.reduce((n, a) => n + a.count, 0))
      .toBe(demoContacts(ALL).contacts.reduce((n, c) => n + c.submission_count, 0));
  });

  it('is what the leads API returns for the demo site', async () => {
    expect((await leadsApi.listContacts('demo', ALL)).total).toBe(demoContacts(ALL).total);
    expect((await leadsApi.stats('demo')).total).toBe(demoLeadStats().total);
  });
});

describe('demo integrations', () => {
  it('shows all four providers, two connected, and never a credential', () => {
    const providers = demoProviders();
    expect(providers.map((p) => p.id)).toEqual(['zapier', 'mailchimp', 'klaviyo', 'hubspot']);
    expect(providers.filter((p) => p.connection).map((p) => p.id)).toEqual(['zapier', 'mailchimp']);
    expect(JSON.stringify(providers)).not.toMatch(/credentials"|api_key":"|secret":"/);
  });

  it('has a delivery log with each outcome and honours the limit', () => {
    const log = demoDeliveries();
    expect(new Set(log.map((d) => d.status))).toEqual(new Set(['success', 'failed', 'skipped']));
    expect(demoDeliveries(3)).toHaveLength(3);
    const connected = new Set(demoProviders().filter((p) => p.connection).map((p) => p.id));
    expect(log.every((d) => connected.has(d.provider))).toBe(true);
  });

  it('is what the integrations API returns for the demo site', async () => {
    expect((await integrationsApi.list('demo')).length).toBe(4);
    expect((await integrationsApi.deliveries('demo', 4)).length).toBe(4);
  });
});

describe('demo popups', () => {
  it('adds the two lead-capture popups, with definitions the builder can open', () => {
    const { automations, total } = demoAutomations();
    expect(total).toBe(automations.length);
    for (const id of ['demo-auto-5', 'demo-auto-6']) {
      const a = automations.find((x) => x.id === id) as { definition?: { graph?: unknown } } | undefined;
      expect(a?.definition?.graph).toBeTruthy();
    }
  });
});
