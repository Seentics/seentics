import { beforeEach, describe, expect, it, vi } from 'vitest';

const { get, post, patch, del } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), patch: vi.fn(), del: vi.fn() }));
vi.mock('@/lib/api', () => ({ default: { get, post, patch, delete: del } }));

import {
  assignWebsite, createAgencyAPIKey, createClient, createEmbedLink, listEmbedLinks,
  revokeEmbedLink, unassignWebsite, updateEmbedLinkSections,
} from '@/features/agency/api';

const wire = (over: Record<string, unknown> = {}) => ({
  id: 'l1', scope: 'website', target_id: 'w1', target_name: 'Shop', token: 'tok',
  embed_url: '/embed/w1?token=tok', sections: ['analytics', 'heatmaps'], created_at: '2026-01-01T00:00:00Z', ...over,
});

beforeEach(() => { get.mockReset(); post.mockReset(); patch.mockReset(); del.mockReset(); });

describe('embed links', () => {
  it('lists and maps snake_case to camelCase', async () => {
    get.mockResolvedValue({ data: { data: [wire()] } });
    const [l] = await listEmbedLinks();
    expect(get).toHaveBeenCalledWith('/user/agency/embed-links');
    expect(l).toEqual({
      id: 'l1', scope: 'website', targetId: 'w1', targetName: 'Shop', token: 'tok',
      embedUrl: '/embed/w1?token=tok', sections: ['analytics', 'heatmaps'], createdAt: '2026-01-01T00:00:00Z',
    });
  });

  it('keeps only the path and query of an absolute embed url, so the link is built from the page it is shown on', async () => {
    get.mockResolvedValue({ data: { data: [wire({ embed_url: 'http://localhost:4000/embed/w1?token=tok&client=1' })] } });
    expect((await listEmbedLinks())[0]!.embedUrl).toBe('/embed/w1?token=tok&client=1');
  });

  it('defaults sections to analytics when the server omits them', async () => {
    get.mockResolvedValue({ data: { data: [wire({ sections: undefined })] } });
    expect((await listEmbedLinks())[0]!.sections).toEqual(['analytics']);
  });

  it('creates for a website with optional sections', async () => {
    post.mockResolvedValue({ data: { data: wire() } });
    await createEmbedLink({ websiteId: 'w1' }, ['analytics', 'recordings']);
    expect(post).toHaveBeenCalledWith('/user/agency/embed-links', { website_id: 'w1', sections: ['analytics', 'recordings'] });
  });

  it('creates for a client and omits sections when none given', async () => {
    post.mockResolvedValue({ data: { data: wire({ scope: 'client' }) } });
    await createEmbedLink({ clientId: 'c1' });
    expect(post).toHaveBeenCalledWith('/user/agency/embed-links', { client_id: 'c1' });
  });

  it('updates sections with PATCH and maps the result', async () => {
    patch.mockResolvedValue({ data: { data: wire({ sections: ['recordings'] }) } });
    const l = await updateEmbedLinkSections('l1', ['recordings']);
    expect(patch).toHaveBeenCalledWith('/user/agency/embed-links/l1', { sections: ['recordings'] });
    expect(l.sections).toEqual(['recordings']);
  });

  it('revokes with DELETE', async () => {
    del.mockResolvedValue({});
    await revokeEmbedLink('l1');
    expect(del).toHaveBeenCalledWith('/user/agency/embed-links/l1');
  });
});

describe('website assignment', () => {
  it('assign PATCHes the website with the client id', async () => {
    patch.mockResolvedValue({});
    await assignWebsite('c1', 'w1');
    expect(patch).toHaveBeenCalledWith('/user/agency/websites/w1', { client_id: 'c1' });
  });
  it('unassign PATCHes the website with a null client id', async () => {
    patch.mockResolvedValue({});
    await unassignWebsite('c1', 'w1');
    expect(patch).toHaveBeenCalledWith('/user/agency/websites/w1', { client_id: null });
  });
});

describe('createClient and account keys', () => {
  it('sends an inline website', async () => {
    post.mockResolvedValue({ data: { data: {
      id: 'c1', external_id: null, name: 'Acme', company: '', email: '', website_url: '', status: 'active', note: '',
      features_enabled: {}, limits: { max_websites: null, max_monthly_events: null, max_replays: null, max_heatmaps: null },
      metadata: {}, websites: [], created_at: '', updated_at: '',
    } } });
    await createClient({ name: 'Acme', website: { name: 'Acme site', url: 'acme.test' } } as any);
    expect(post).toHaveBeenCalledWith('/user/agency/clients', { name: 'Acme', website: { name: 'Acme site', url: 'acme.test' } });
  });

  it('sends no scopes when none are given', async () => {
    post.mockResolvedValue({ data: { data: { id: 'k', name: 'n', key_prefix: 'p', scopes: [], last_used: null, created_at: '' } } });
    await createAgencyAPIKey('n');
    const body = post.mock.calls[0]![1];
    expect(body.name).toBe('n');
    expect(body.scopes).toBeUndefined();
  });
});
