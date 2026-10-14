import { describe, expect, it } from 'vitest';
import { demoAutomations } from '@/lib/demo';
import { DEMO_DESTINATIONS, demoConnections, demoDeliveries, demoOverview } from '@/lib/demo/integrations';
import { DEMO_FORMS, DEMO_ROUTING, demoFormSummary, demoSubmissionsCsv, demoSubmissionsPage } from '@/lib/demo/submissions';
import { describeRouting, formInfoOf } from '@/lib/form-routing';
import { integrationsApi } from '@/features/integrations/api';
import { submissionsApi } from '@/features/leads/api';

const ALL = { search: '', limit: 100, offset: 0 };
const forms = Object.values(DEMO_FORMS);

describe('demo submissions', () => {
  it('is stable across calls and uses only reserved example.com addresses', () => {
    for (const form of forms) {
      expect(demoSubmissionsPage(form.id, ALL)).toEqual(demoSubmissionsPage(form.id, ALL));
      for (const s of demoSubmissionsPage(form.id, ALL).submissions) expect(s.email.endsWith('@example.com')).toBe(true);
    }
  });

  it('lists newest first, per form, and searches and pages like the real endpoint', () => {
    for (const form of forms) {
      const all = demoSubmissionsPage(form.id, ALL).submissions;
      expect(all.length).toBeGreaterThan(0);
      expect([...all].sort((a, b) => b.created_at.localeCompare(a.created_at))).toEqual(all);
    }
    const wheel = demoSubmissionsPage(DEMO_FORMS.wheel.id, ALL);
    expect(demoSubmissionsPage(DEMO_FORMS.wheel.id, { ...ALL, search: 'AVA' }).submissions.map((s) => s.name)).toEqual(['Ava Martin']);
    const page = demoSubmissionsPage(DEMO_FORMS.wheel.id, { ...ALL, limit: 2, offset: 2 });
    expect(page.submissions).toHaveLength(2);
    expect(page.total).toBe(wheel.total);
    expect(demoSubmissionsPage('nope', ALL)).toEqual({ submissions: [], total: 0 });
  });

  it('points at real demo popups, and only wheel submissions carry a prize', () => {
    const ids = new Set(demoAutomations().automations.map((a) => a.id));
    for (const form of forms) expect(ids.has(form.id)).toBe(true);
    expect(demoSubmissionsPage(DEMO_FORMS.wheel.id, ALL).submissions.every((s) => s.prize)).toBe(true);
    expect(demoSubmissionsPage(DEMO_FORMS.newsletter.id, ALL).submissions.every((s) => !s.prize)).toBe(true);
  });

  it('shows deliveries to exactly the destinations the form is routed to, all of which exist', () => {
    const connections = new Set(demoConnections().map((c) => c.id));
    for (const form of forms) {
      const routed = DEMO_ROUTING[form.id]!;
      for (const s of demoSubmissionsPage(form.id, ALL).submissions) {
        expect(s.deliveries.map((d) => d.connection_id).sort()).toEqual([...routed].sort());
        for (const d of s.deliveries) expect(connections.has(d.connection_id)).toBe(true);
      }
    }
  });

  it('reports a summary that agrees with the list', () => {
    for (const form of forms) {
      const list = demoSubmissionsPage(form.id, ALL);
      const summary = demoFormSummary(form.id);
      expect(summary.total).toBe(list.total);
      expect(summary.by_variant.reduce((n, v) => n + v.count, 0)).toBe(list.total);
      expect(summary.last_7_days).toBeLessThanOrEqual(summary.last_30_days);
      expect(summary.last_30_days).toBeLessThanOrEqual(summary.total);
    }
    expect(demoFormSummary(DEMO_FORMS.wheel.id).with_prize).toBe(demoFormSummary(DEMO_FORMS.wheel.id).total);
  });

  it('exports one csv row per submission', () => {
    const rows = demoSubmissionsCsv(DEMO_FORMS.wheel.id).split('\n');
    expect(rows.length - 1).toBe(demoSubmissionsPage(DEMO_FORMS.wheel.id, ALL).total);
  });

  it('is what the submissions API returns for the demo site', async () => {
    expect((await submissionsApi.list('demo', DEMO_FORMS.wheel.id, ALL)).total).toBe(demoSubmissionsPage(DEMO_FORMS.wheel.id, ALL).total);
    expect((await submissionsApi.summary('demo', DEMO_FORMS.newsletter.id)).total).toBe(demoFormSummary(DEMO_FORMS.newsletter.id).total);
  });
});

describe('demo destinations', () => {
  it('has three, two of them webhooks, and never a credential', () => {
    const { providers, connections } = demoOverview();
    expect(providers.map((p) => p.id)).toEqual(['zapier', 'mailchimp', 'klaviyo', 'hubspot']);
    expect(connections.map((c) => c.provider).sort()).toEqual(['mailchimp', 'zapier', 'zapier']);
    expect(new Set(connections.map((c) => c.id)).size).toBe(3);
    expect(JSON.stringify(connections)).not.toMatch(/credentials"|api_key":"|secret":"|webhook_url/);
  });

  it('shows a healthy, a retrying and a switched-off destination', () => {
    const byId = new Map(demoConnections().map((c) => [c.id, c]));
    expect(byId.get(DEMO_DESTINATIONS.crm)).toMatchObject({ enabled: true, status: 'active', pending_count: 0 });
    expect(byId.get(DEMO_DESTINATIONS.mailchimp)!.pending_count).toBeGreaterThan(0);
    expect(byId.get(DEMO_DESTINATIONS.slack)).toMatchObject({ enabled: false, status: 'error' });
  });

  it('has a delivery log with every state, filters and honours the limit', () => {
    const log = demoDeliveries();
    expect(new Set(log.map((d) => d.status))).toEqual(new Set(['success', 'pending', 'failed', 'skipped']));
    expect(demoDeliveries({ limit: 3 })).toHaveLength(3);
    expect(demoDeliveries({ status: 'failed' }).every((d) => d.status === 'failed')).toBe(true);
    expect(demoDeliveries({ connection_id: DEMO_DESTINATIONS.slack }).every((d) => d.connection_id === DEMO_DESTINATIONS.slack)).toBe(true);
    const connected = new Set(demoConnections().map((c) => c.id));
    expect(log.every((d) => connected.has(d.connection_id))).toBe(true);
    expect(log.filter((d) => d.status === 'pending').every((d) => d.next_attempt_at && !d.completed_at)).toBe(true);
  });

  it('is what the integrations API returns for the demo site', async () => {
    expect((await integrationsApi.overview('demo')).connections.length).toBe(3);
    expect((await integrationsApi.deliveries('demo', { limit: 4 })).length).toBe(4);
  });
});

describe('demo popups', () => {
  it('are lead forms whose routing matches the destinations, with definitions the builder can open', () => {
    const { automations, total } = demoAutomations();
    expect(total).toBe(automations.length);
    const connections = demoConnections();
    for (const id of ['demo-auto-5', 'demo-auto-6']) {
      const a = automations.find((x) => x.id === id) as { definition?: { graph?: unknown } } | undefined;
      expect(a?.definition?.graph).toBeTruthy();
      const info = formInfoOf(a!.definition);
      expect(info.destinations).toEqual(DEMO_ROUTING[id]);
      // The newsletter form routes to the paused Slack destination, so its page shows no "sent nowhere" warning
      // (the webhook still receives) while the destination itself is visibly paused.
      expect(describeRouting(info.destinations, connections).warning).toBeNull();
    }
  });
});
