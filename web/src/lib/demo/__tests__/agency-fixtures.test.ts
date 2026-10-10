import { describe, expect, it } from 'vitest';
import { demoAgencyClients, demoAgencyKeys, demoClientUsers, demoEmbedLinks, demoWhiteLabel } from '@/lib/demo/agency';

const SCOPES = ['websites:read', 'websites:write', 'analytics:read', 'replays:read', 'heatmaps:read'];
const SECTIONS = ['analytics', 'recordings', 'heatmaps'];

describe('agency demo fixtures', () => {
  it('every client login matches a client by email (the Login column joins on it)', () => {
    const emails = new Set(demoAgencyClients().map(c => c.email.toLowerCase()));
    for (const u of demoClientUsers()) expect(emails.has(u.email.toLowerCase())).toBe(true);
  });

  it('embed links point at real demo targets with valid, non-empty sections', () => {
    const clients = new Set(demoAgencyClients().map(c => c.id));
    for (const l of demoEmbedLinks()) {
      if (l.scope === 'client') expect(clients.has(l.targetId)).toBe(true);
      else expect(l.targetId).toBe('demo');
      expect(l.sections.length).toBeGreaterThan(0);
      for (const s of l.sections) expect(SECTIONS).toContain(s);
      expect(l.embedUrl).toContain(`token=${l.token}`);
    }
  });

  it('account keys only use known scopes', () => {
    for (const k of demoAgencyKeys()) for (const s of k.scopes) expect(SCOPES).toContain(s);
  });

  it('white-label has the expected shape', () => {
    const w = demoWhiteLabel();
    expect(w).toMatchObject({ brandName: expect.any(String), hideSeentics: expect.any(Boolean) });
    expect(w.primaryColor).toMatch(/^#[0-9a-f]{6}$/i);
    expect(w.supportEmail).toContain('@');
  });
});
