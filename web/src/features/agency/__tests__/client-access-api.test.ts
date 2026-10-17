import { beforeEach, describe, expect, it, vi } from 'vitest';

const { get, post, put, patch, del } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn() }));
vi.mock('@/lib/api', () => ({ default: { get, post, put, patch, delete: del } }));

import {
  createClientUser, createPortalLink, customDomainError, deleteClientUser, getCustomDomain, getWhiteLabel,
  listClientUsers, portalLinkUrl, refreshCustomDomain, removeCustomDomain, resendClientUserLink, revokeClientUser,
  revokePortalLink, setCustomDomain, updateWhiteLabel,
} from '@/features/agency/api';
import type { CustomDomain } from '@/features/agency/types';

const wireUser = (over: Record<string, unknown> = {}) => ({
  id: 'u1', client_id: 'c1', email: 'jane@acme.test', name: 'Jane', status: 'invited',
  created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z', last_seen_at: null, link_expires_at: '2026-10-31T00:00:00Z', ...over,
});
const wireLink = {
  id: 't1', client_id: 'c1', token: 'scp_abc', portal_url: 'https://seentics.com/client-portal/scp_abc',
  expires_at: '2026-10-31T00:00:00Z', created_at: '2026-10-01T00:00:00Z',
};
const wireDomain = {
  hostname: 'reports.acme.test', state: 'pending_dns', reason: null, cname_target: 'portal.seentics.com',
  ownership_verification: { name: '_cf-custom-hostname.reports.acme.test', type: 'txt', value: 'abc-123' },
  created_at: '2026-10-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z', last_checked_at: null,
};

beforeEach(() => { for (const f of [get, post, put, patch, del]) f.mockReset(); });

describe('client users (magic links)', () => {
  it('invites with { client_id, email, name } and returns the user and the link, once', async () => {
    post.mockResolvedValue({ data: { data: { client_user: wireUser(), link: wireLink } } });
    const issued = await createClientUser({ clientId: 'c1', email: 'jane@acme.test', name: 'Jane' });
    expect(post).toHaveBeenCalledWith('/user/agency/client-users', { client_id: 'c1', email: 'jane@acme.test', name: 'Jane' });
    expect(issued.clientUser).toMatchObject({ id: 'u1', clientId: 'c1', status: 'invited', linkExpiresAt: '2026-10-31T00:00:00Z' });
    expect(issued.link).toEqual({
      id: 't1', clientId: 'c1', token: 'scp_abc', portalUrl: 'https://seentics.com/client-portal/scp_abc',
      expiresAt: '2026-10-31T00:00:00Z', createdAt: '2026-10-01T00:00:00Z',
    });
  });

  it('leaves out an empty name', async () => {
    post.mockResolvedValue({ data: { data: { client_user: wireUser(), link: wireLink } } });
    await createClientUser({ clientId: 'c1', email: 'jane@acme.test' });
    expect(post.mock.calls[0]![1]).toEqual({ client_id: 'c1', email: 'jane@acme.test' });
  });

  it('lists, narrowed to a client', async () => {
    get.mockResolvedValue({ data: { data: [wireUser({ status: 'active', last_seen_at: '2026-10-02T00:00:00Z' })] } });
    const [u] = await listClientUsers('c1');
    expect(get).toHaveBeenCalledWith('/user/agency/client-users', { params: { client_id: 'c1' } });
    expect(u).toMatchObject({ status: 'active', lastSeenAt: '2026-10-02T00:00:00Z' });
  });

  it('resends, revokes and deletes by id', async () => {
    post.mockResolvedValueOnce({ data: { data: { client_user: wireUser(), link: wireLink } } });
    expect((await resendClientUserLink('u1')).link.token).toBe('scp_abc');
    expect(post).toHaveBeenLastCalledWith('/user/agency/client-users/u1/resend');

    post.mockResolvedValueOnce({ data: { data: wireUser({ status: 'revoked', link_expires_at: null }) } });
    expect((await revokeClientUser('u1')).status).toBe('revoked');
    expect(post).toHaveBeenLastCalledWith('/user/agency/client-users/u1/revoke');

    del.mockResolvedValue({});
    await deleteClientUser('u1');
    expect(del).toHaveBeenCalledWith('/user/agency/client-users/u1');
  });

  it('makes and stops the client\'s anonymous link', async () => {
    post.mockResolvedValue({ data: { data: wireLink } });
    expect((await createPortalLink('c1')).portalUrl).toBe(wireLink.portal_url);
    expect(post).toHaveBeenCalledWith('/user/agency/clients/c1/portal-token');
    del.mockResolvedValue({});
    await revokePortalLink('c1');
    expect(del).toHaveBeenCalledWith('/user/agency/clients/c1/portal-token');
  });
});

describe('white label', () => {
  const wire = { user_id: 'o', brand_name: 'NW', logo_url: '', primary_color: '#112233', support_email: '', footer_text: 'By NW', hide_seentics: true, updated_at: null };

  it('maps the settings, with no custom domain in them', async () => {
    get.mockResolvedValue({ data: { data: wire } });
    expect(await getWhiteLabel()).toEqual({
      brandName: 'NW', logoUrl: '', primaryColor: '#112233', supportEmail: '', footerText: 'By NW', hideSeentics: true, updatedAt: null,
    });
  });

  it('PATCHes only the fields given, in snake_case', async () => {
    patch.mockResolvedValue({ data: { data: wire } });
    await updateWhiteLabel({ footerText: 'By NW', hideSeentics: true, logoUrl: '' });
    expect(patch).toHaveBeenCalledWith('/user/agency/white-label', { footer_text: 'By NW', hide_seentics: true, logo_url: '' });
  });
});

describe('custom domain', () => {
  it('reads null as no domain, and maps one', async () => {
    get.mockResolvedValueOnce({ data: { data: null } });
    expect(await getCustomDomain()).toBeNull();
    get.mockResolvedValueOnce({ data: { data: wireDomain } });
    expect(await getCustomDomain()).toMatchObject({
      hostname: 'reports.acme.test', state: 'pending_dns', cnameTarget: 'portal.seentics.com',
      ownershipVerification: { name: '_cf-custom-hostname.reports.acme.test', type: 'txt', value: 'abc-123' },
    });
  });

  it('PUTs the hostname, POSTs refresh and DELETEs', async () => {
    put.mockResolvedValue({ data: { data: wireDomain } });
    await setCustomDomain('reports.acme.test');
    expect(put).toHaveBeenCalledWith('/user/agency/custom-domain', { hostname: 'reports.acme.test' });
    post.mockResolvedValue({ data: { data: { ...wireDomain, state: 'active' } } });
    expect((await refreshCustomDomain()).state).toBe('active');
    expect(post).toHaveBeenCalledWith('/user/agency/custom-domain/refresh');
    del.mockResolvedValue({ status: 204 });
    await removeCustomDomain();
    expect(del).toHaveBeenCalledWith('/user/agency/custom-domain');
  });

  it('words each gateway error', () => {
    const err = (status: number, data: Record<string, unknown>) => ({ response: { status, data } });
    expect(customDomainError(err(400, { error: 'invalid_hostname', message: 'Use a subdomain, not seentics.com.' }))).toBe('Use a subdomain, not seentics.com.');
    expect(customDomainError(err(409, { error: 'hostname_taken' }))).toMatch(/already in use/);
    expect(customDomainError(err(503, { error: 'custom_domains_unavailable' }))).toMatch(/unavailable right now/);
    expect(customDomainError(err(502, { error: 'custom_domain_provider_error' }))).toMatch(/certificate provider/);
    expect(customDomainError(err(429, { error: 'rate_limit_exceeded' }))).toMatch(/Too many domain changes/);
    expect(customDomainError(err(404, { error: 'not_found' }))).toMatch(/no custom domain/);
  });
});

describe('portalLinkUrl', () => {
  const link = { token: 'scp_abc', portalUrl: 'https://seentics.com/client-portal/scp_abc' };
  const domain = (state: CustomDomain['state']): CustomDomain => ({
    hostname: 'reports.acme.test', state, reason: null, cnameTarget: 'portal.seentics.com', ownershipVerification: null,
    createdAt: '', updatedAt: '', lastCheckedAt: null,
  });

  it('uses the agency domain only once it is active', () => {
    expect(portalLinkUrl(link, domain('active'))).toBe('https://reports.acme.test/client-portal/scp_abc');
    for (const state of ['pending_dns', 'pending_certificate', 'failed'] as const) expect(portalLinkUrl(link, domain(state))).toBe(link.portalUrl);
    expect(portalLinkUrl(link, null)).toBe(link.portalUrl);
  });
});
