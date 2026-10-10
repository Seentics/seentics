import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  EmbedTokenError, fetchEmbedClientSites, fetchEmbedInfo, isSampleToken,
} from '@/features/embed/api';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);
afterEach(() => fetchMock.mockReset());

const ok = (data: unknown) => ({ ok: true, status: 200, json: async () => ({ data }) });
const fail = (status: number) => ({ ok: false, status, json: async () => ({}) });

describe('sample tokens', () => {
  it('treats only tokens starting "demo" as samples', () => {
    expect(isSampleToken('demo')).toBe(true);
    expect(isSampleToken('demo-analytics')).toBe(true);
    expect(isSampleToken('abc123')).toBe(false);
    expect(isSampleToken('not-demo')).toBe(false);
  });

  it('`demo` shows every section, `demo-analytics` only analytics, without a request', async () => {
    expect((await fetchEmbedInfo('x', 'demo')).sections).toEqual(['analytics', 'recordings', 'heatmaps']);
    expect((await fetchEmbedInfo('x', 'demo-analytics')).sections).toEqual(['analytics']);
    expect((await fetchEmbedClientSites('c', 'demo')).sections).toEqual(['analytics', 'recordings', 'heatmaps']);
    const sites = await fetchEmbedClientSites('c', 'demo-analytics');
    expect(sites.sections).toEqual(['analytics']);
    expect(sites.websites.length).toBeGreaterThan(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('fetchEmbedInfo', () => {
  it('asks /embed/:id/info with the token and returns the parsed data', async () => {
    const info = { website: { name: 'Shop', url: 'shop.test' }, sections: ['analytics', 'heatmaps'] };
    fetchMock.mockResolvedValue(ok(info));
    expect(await fetchEmbedInfo('site1', 'real-token')).toEqual(info);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(/\/embed\/site1\/info$/);
    expect(init.headers).toEqual({ 'X-Embed-Token': 'real-token' });
  });

  it('maps 401 to EmbedTokenError', async () => {
    fetchMock.mockResolvedValue(fail(401));
    await expect(fetchEmbedInfo('site1', 'bad')).rejects.toBeInstanceOf(EmbedTokenError);
  });

  it('maps other failures to a generic Error, not EmbedTokenError', async () => {
    fetchMock.mockResolvedValue(fail(500));
    const err = await fetchEmbedInfo('site1', 'tok').catch(e => e);
    expect(err).toBeInstanceOf(Error);
    expect(err).not.toBeInstanceOf(EmbedTokenError);
    expect(err.message).toContain('500');
  });
});

describe('fetchEmbedClientSites', () => {
  it('asks /embed/client/:id/websites with the token and returns the data', async () => {
    const data = { client: { name: 'Acme' }, websites: [{ id: 'a', name: 'A', url: 'a.test' }], sections: ['analytics'] };
    fetchMock.mockResolvedValue(ok(data));
    expect(await fetchEmbedClientSites('cl1', 'real-token')).toEqual(data);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toMatch(/\/embed\/client\/cl1\/websites$/);
    expect(init.headers).toEqual({ 'X-Embed-Token': 'real-token' });
  });

  it('maps 401 and other failures like fetchEmbedInfo', async () => {
    fetchMock.mockResolvedValueOnce(fail(401));
    await expect(fetchEmbedClientSites('cl1', 'bad')).rejects.toBeInstanceOf(EmbedTokenError);
    fetchMock.mockResolvedValueOnce(fail(503));
    const err = await fetchEmbedClientSites('cl1', 'tok').catch(e => e);
    expect(err).not.toBeInstanceOf(EmbedTokenError);
    expect(err.message).toContain('503');
  });
});
