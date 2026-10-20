import { describe, expect, it } from 'vitest';
import { demoContactsPage, demoLeadsOverview, demoSiteSubmissionsPage } from '@/lib/demo/leads';

const all = { search: '', form: '', from: '', to: '', limit: 100, offset: 0 };
const people = { search: '', status: '' as const, tag: '', source: '' as const, sort: 'last_activity' as const, limit: 100, offset: 0 };

describe('leads demo: filters and overview', () => {
  it('narrows the inbox to submissions a destination could not take', () => {
    const failed = demoSiteSubmissionsPage({ ...all, delivery: 'failed' });
    expect(failed.total).toBeGreaterThan(0);
    expect(failed.total).toBeLessThan(demoSiteSubmissionsPage(all).total);
    expect(failed.submissions.every((s) => s.deliveries.some((d) => d.status === 'failed'))).toBe(true);
  });

  it('filters people by where they first came from', () => {
    const paid = demoContactsPage({ ...people, channel: 'paid' });
    expect(paid.total).toBeGreaterThan(0);
    expect(paid.contacts.every((c) => c.first_channel === 'paid')).toBe(true);
    const campaign = paid.contacts.find((c) => c.first_campaign)?.first_campaign;
    expect(campaign).toBeTruthy();
    expect(demoContactsPage({ ...people, campaign: campaign! }).contacts.every((c) => c.first_campaign === campaign)).toBe(true);
  });

  it('adds up the window: submissions, their channels and campaigns, new people and failures', () => {
    const o = demoLeadsOverview(90);
    expect(o.days).toBe(90);
    expect(o.submissions).toBeGreaterThan(0);
    expect(o.by_channel.reduce((n, c) => n + c.count, 0)).toBe(o.submissions);
    expect(o.by_campaign.length).toBeLessThanOrEqual(5);
    expect(o.customers).toBeLessThanOrEqual(o.new_contacts);
    expect(o.failed_deliveries).toBeLessThanOrEqual(o.submissions);
  });
});
