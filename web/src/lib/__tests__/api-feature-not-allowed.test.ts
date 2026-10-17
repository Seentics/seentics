import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InternalAxiosRequestConfig } from 'axios';

/**
 * Client mode: when the gateway refuses a client user a page or an action their agency has not
 * allowed (403 `feature_not_allowed`), the API client says so in one friendly toast, however
 * many requests were refused, and never signs anyone out.
 */

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn(), info: vi.fn() }));
vi.mock('sonner', () => ({ toast }));

import api, { isFeatureNotAllowed } from '@/lib/api';

let respond: (c: InternalAxiosRequestConfig) => { status: number; data?: unknown } = () => ({ status: 200, data: {} });

beforeEach(() => {
  toast.error.mockClear();
  api.defaults.adapter = async (config) => {
    const { status, data } = respond(config);
    const response = { data, status, statusText: '', headers: {}, config };
    if (status >= 400) {
      const err: any = new Error(`status ${status}`);
      err.config = config;
      err.response = response;
      throw err;
    }
    return response;
  };
  localStorage.setItem('auth-storage', JSON.stringify({ state: { isAuthenticated: true, access_token: 'a', user: { kind: 'client' } } }));
});

afterEach(() => localStorage.clear());

describe('403 feature_not_allowed', () => {
  it('shows one toast and rejects with the response kept', async () => {
    respond = () => ({ status: 403, data: { error: 'feature_not_allowed', feature: 'funnels' } });
    const err = await api.post('/funnels/w1', {}).catch((e) => e);
    expect(err.response.status).toBe(403);
    expect(err.response.data.feature).toBe('funnels');
    expect(toast.error).toHaveBeenCalledTimes(1);
    const [title, opts] = toast.error.mock.calls[0]!;
    expect(title).toBe('Not available');
    expect(opts).toMatchObject({ id: 'feature-not-allowed' });
    expect(localStorage.getItem('auth-storage')).not.toBeNull();
  });

  it('leaves other 403s to their callers', async () => {
    respond = () => ({ status: 403, data: { error: 'forbidden' } });
    await api.get('/websites/w1/team').catch(() => undefined);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('reads both error shapes', () => {
    expect(isFeatureNotAllowed({ error: 'feature_not_allowed' })).toBe(true);
    expect(isFeatureNotAllowed({ error: { code: 'feature_not_allowed', message: 'x' } })).toBe(true);
    expect(isFeatureNotAllowed({ error: 'forbidden' })).toBe(false);
    expect(isFeatureNotAllowed(undefined)).toBe(false);
  });
});
