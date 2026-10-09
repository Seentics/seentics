import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The developer tab's data layer.
 *
 * The reference is built from the server's catalogue rather than a copy in the client,
 * so what matters here is that the client asks for it, groups it the way the server
 * ordered it, and builds an example a developer can paste without editing anything but
 * their key.
 */

const { get, post, del } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), del: vi.fn() }));

vi.mock('@/lib/api', () => ({ default: { get, post, delete: del, put: vi.fn() } }));

import {
  createApiKey,
  fetchApiCatalogue,
  fetchApiKeys,
  fetchApiScopes,
  revokeApiKey,
} from '@/features/api-keys/api';
import type { ApiEndpoint } from '@/features/api-keys/types';

const SITE = 'ab12cd34';

const endpoint = (over: Partial<ApiEndpoint> = {}): ApiEndpoint => ({
  path: '/v1/websites/:website_id/analytics/top-pages',
  method: 'GET',
  group: 'Analytics',
  summary: 'Most-viewed pages.',
  scope: 'analytics:read',
  params: [
    { name: 'days', description: 'Trailing window.', default: '7' },
    { name: 'timezone', description: 'IANA zone.', default: 'UTC' },
  ],
  example: { data: { top_pages: [] } },
  ...over,
});

beforeEach(() => {
  get.mockReset();
  post.mockReset();
  del.mockReset();
});

// -- Keys --------------------------------------------------------------------

describe('fetchApiKeys', () => {
  it('unwraps the data envelope', async () => {
    get.mockResolvedValue({ data: { data: [{ id: 'k1', name: 'Prod' }] } });
    expect(await fetchApiKeys(SITE)).toHaveLength(1);
    expect(get).toHaveBeenCalledWith(`/websites/${SITE}/api-keys`);
  });

  it('returns an empty list rather than throwing on an unexpected payload', async () => {
    get.mockResolvedValue({ data: {} });
    expect(await fetchApiKeys(SITE)).toEqual([]);
  });
});

describe('fetchApiScopes', () => {
  it('reads the scope vocabulary from the server', async () => {
    // The form is built from this, so it cannot offer a scope the backend rejects.
    get.mockResolvedValue({ data: { data: [{ scope: 'analytics:read', description: 'Traffic' }] } });
    const scopes = await fetchApiScopes();

    expect(get).toHaveBeenCalledWith('/websites/scopes');
    expect(scopes[0]!.scope).toBe('analytics:read');
  });
});

describe('createApiKey', () => {
  it('posts the name and scopes and returns the secret', async () => {
    post.mockResolvedValue({ data: { data: { id: 'k1', name: 'Prod', secret: 'snt_abc_xyz' } } });
    const key = await createApiKey(SITE, 'Prod', ['analytics:read']);

    expect(post).toHaveBeenCalledWith(`/websites/${SITE}/api-keys`, {
      name: 'Prod',
      scopes: ['analytics:read'],
    });
    expect(key.secret).toBe('snt_abc_xyz');
  });
});

describe('revokeApiKey', () => {
  it('deletes the key by id', async () => {
    del.mockResolvedValue({ status: 204 });
    await revokeApiKey(SITE, 'k1');
    expect(del).toHaveBeenCalledWith(`/websites/${SITE}/api-keys/k1`);
  });
});

// -- Catalogue ---------------------------------------------------------------

describe('fetchApiCatalogue', () => {
  it('reads the reference from the server rather than a copy in the client', async () => {
    // A hard-coded list in the client drifts the moment an endpoint is added; the
    // server's catalogue is tested against its own router.
    const payload = { meta: { base_path: '/api/v1/raw', auth: 'X-API-Key', count: 1 }, data: [endpoint()] };
    get.mockResolvedValue({ data: payload });

    expect(await fetchApiCatalogue()).toEqual(payload);
    expect(get).toHaveBeenCalledWith('/raw/v1/catalogue');
  });
});
