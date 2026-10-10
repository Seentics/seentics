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

import { fetchApiCatalogue } from '@/features/api-keys/api';
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
