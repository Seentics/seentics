import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { InternalAxiosRequestConfig } from 'axios';
import api, { setApiToken, setEmbedToken, toEmbedUrl } from '@/lib/api';

/**
 * Embed mode: a page iframed into someone else's product holds a link token, no session.
 * The adapter is replaced so the tests see the request exactly as it would leave the browser.
 */

let sent: InternalAxiosRequestConfig[] = [];
let respondWith: (c: InternalAxiosRequestConfig) => { status: number; data?: unknown } = () => ({ status: 200, data: {} });

beforeEach(() => {
  sent = [];
  respondWith = () => ({ status: 200, data: {} });
  api.defaults.adapter = async (config) => {
    sent.push(config);
    const { status, data } = respondWith(config);
    const response = { data, status, statusText: '', headers: {}, config };
    if (status >= 400) {
      const err: any = new Error(`status ${status}`);
      err.config = config;
      err.response = response;
      throw err;
    }
    return response;
  };
  setApiToken('session-jwt');
  localStorage.setItem('auth-storage', JSON.stringify({ state: { isAuthenticated: true, access_token: 'session-jwt', refresh_token: 'r' } }));
});

afterEach(() => {
  setEmbedToken(null);
  setApiToken(null);
  localStorage.clear();
});

describe('toEmbedUrl', () => {
  it('maps analytics calls, keeping the query string', () => {
    expect(toEmbedUrl('/analytics/top-pages/site1?days=7&timezone=UTC')).toBe('/embed/site1/analytics/top-pages?days=7&timezone=UTC');
    expect(toEmbedUrl('/analytics/dashboard/site1')).toBe('/embed/site1/analytics/dashboard');
  });

  it('maps the replay list and a single replay', () => {
    expect(toEmbedUrl('/replays/site1')).toBe('/embed/site1/replays');
    expect(toEmbedUrl('/replays/site1?limit=20')).toBe('/embed/site1/replays?limit=20');
    expect(toEmbedUrl('/replays/site1/sess-9')).toBe('/embed/site1/replays/sess-9');
    expect(toEmbedUrl('/replays/site1/sess-9/events?x=1')).toBe('/embed/site1/replays/sess-9/events?x=1');
  });

  it('maps heatmap calls with their remainder and query', () => {
    expect(toEmbedUrl('/heatmaps/site1/list?days=7')).toBe('/embed/site1/heatmaps/list?days=7');
    expect(toEmbedUrl('/heatmaps/site1/slug-a/data')).toBe('/embed/site1/heatmaps/slug-a/data');
  });

  it('leaves unrelated and already-embed URLs alone', () => {
    for (const u of ['/user/websites', '/funnels/site1', '/embed/site1/info', '/analytics/site1', '/auth/refresh', '']) {
      expect(toEmbedUrl(u)).toBe(u);
    }
  });
});

describe('request interceptor while embedded', () => {
  it('rewrites the URL and sends the embed token without Authorization or credentials', async () => {
    setEmbedToken('tok-123');
    await api.get('/analytics/top-pages/site1?days=7');
    const c = sent[0]!;
    expect(c.url).toBe('/embed/site1/analytics/top-pages?days=7');
    expect(c.headers.get('X-Embed-Token')).toBe('tok-123');
    expect(c.headers.get('Authorization')).toBeFalsy();
    expect(c.withCredentials).toBe(false);
  });

  it('does not rewrite unrelated URLs, and sends them neither the embed token nor the session', async () => {
    setEmbedToken('tok-123');
    await api.get('/user/websites');
    expect(sent[0]!.url).toBe('/user/websites');
    expect(sent[0]!.headers.get('X-Embed-Token'), 'the link secret goes only to the embed API').toBeFalsy();
    expect(sent[0]!.headers.get('Authorization')).toBeFalsy();
  });

  it('does not redirect, refresh or retry on a 401', async () => {
    setEmbedToken('tok-123');
    respondWith = () => ({ status: 401, data: {} });
    await expect(api.get('/analytics/top-pages/site1')).rejects.toBeTruthy();
    expect(sent).toHaveLength(1); // no refresh call, no retry
    expect(localStorage.getItem('auth-storage')).not.toBeNull(); // not logged out
  });
});

describe('with the embed token cleared', () => {
  it('rewrites nothing and brings the auth header back', async () => {
    setEmbedToken('tok-123');
    setEmbedToken(null);
    await api.get('/analytics/top-pages/site1?days=7');
    const c = sent[0]!;
    expect(c.url).toBe('/analytics/top-pages/site1?days=7');
    expect(c.headers.get('X-Embed-Token')).toBeFalsy();
    expect(c.headers.get('Authorization')).toBe('Bearer session-jwt');
  });
});
