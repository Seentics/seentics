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
  curlFor,
  createApiKey,
  fetchApiCatalogue,
  fetchApiKeys,
  fetchApiScopes,
  groupEndpoints,
  revokeApiKey,
  type ApiEndpoint,
} from '@/lib/api-keys-api';

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

describe('groupEndpoints', () => {
  it('groups by the server-provided group', () => {
    const grouped = groupEndpoints([
      endpoint({ path: '/a', group: 'Analytics' }),
      endpoint({ path: '/b', group: 'Heatmaps' }),
      endpoint({ path: '/c', group: 'Analytics' }),
    ]);

    expect(grouped.map(([g]) => g)).toEqual(['Analytics', 'Heatmaps']);
    expect(grouped[0]![1]).toHaveLength(2);
  });

  it('preserves the catalogue order rather than sorting', () => {
    // The server orders endpoints so the reference reads sensibly; re-sorting here would
    // scatter related reads.
    const grouped = groupEndpoints([
      endpoint({ path: '/z', group: 'Sessions' }),
      endpoint({ path: '/a', group: 'Analytics' }),
    ]);
    expect(grouped.map(([g]) => g)).toEqual(['Sessions', 'Analytics']);
  });

  it('returns nothing for an empty catalogue', () => {
    expect(groupEndpoints([])).toEqual([]);
  });
});

// -- Examples ----------------------------------------------------------------

describe('curlFor', () => {
  const build = (e: ApiEndpoint) => curlFor(e, '/api/v1/raw', 'https://app.test', SITE);

  it('substitutes the website id so the example is runnable as-is', () => {
    expect(build(endpoint())).toContain(`/v1/websites/${SITE}/analytics/top-pages`);
    expect(build(endpoint())).not.toContain(':website_id');
  });

  it('includes the base path and origin', () => {
    expect(build(endpoint())).toContain('https://app.test/api/v1/raw');
  });

  it('leaves the key as a shell variable rather than embedding a real one', () => {
    // A reference someone screenshots must not carry a live credential.
    expect(build(endpoint())).toContain('$SEENTICS_API_KEY');
    expect(build(endpoint())).toContain('X-API-Key');
  });

  it('fills in the documented defaults so the example returns something', () => {
    expect(build(endpoint())).toContain('days=7');
    expect(build(endpoint())).toContain('timezone=UTC');
  });

  it('omits parameters that have no default rather than inventing values', () => {
    // A required parameter with a made-up value would produce an example that returns
    // the wrong thing and looks authoritative.
    const e = endpoint({ params: [{ name: 'page_path', description: 'Required.' }] });
    expect(build(e)).not.toContain('page_path=');
  });

  it('emits no query string when nothing has a default', () => {
    const e = endpoint({ params: [] });
    expect(build(e)).not.toContain('?');
  });
});
