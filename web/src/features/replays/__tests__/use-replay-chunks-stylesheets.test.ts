import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const CSS = 'https://shop.test/_next/static/css/3e3ba49c0fe97c41.css';
const SITE = '11111111-1111-4111-8111-111111111111';

/** One stored chunk: the tracker's envelope around an rrweb full snapshot with one stylesheet link. */
const chunk = [
  {
    type: 'rrweb', ts: 1, url: 'https://shop.test/', sid: 's', vid: 'v',
    data: {
      type: 2, timestamp: 1,
      data: { node: { type: 0, id: 1, childNodes: [{ type: 2, id: 2, tagName: 'link', attributes: { rel: 'stylesheet', href: CSS }, childNodes: [] }] } },
    },
  },
];

vi.mock('@/features/replays/api', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/features/replays/api')>();
  return { ...real, fetchGzipJsonArray: vi.fn(async () => JSON.parse(JSON.stringify(chunk))) };
});

const { useReplayChunks } = await import('@/features/replays/use-replay-chunks');

const hrefOf = (events: { data: Record<string, unknown> }[]) =>
  ((events[0]!.data.node as { childNodes: { attributes: { href: string } }[] }).childNodes[0]!.attributes.href);

describe('useReplayChunks — archived stylesheets', () => {
  it('points stylesheet links at the archive before the player gets the events', async () => {
    const session = { replay_chunk_urls: [{ sequence: 0, url: 'https://r2.test/c0' }], stylesheet_token: 'tok' };
    const { result } = renderHook(() => useReplayChunks(session, SITE));
    await waitFor(() => expect(result.current.initialEvents.length).toBe(1));
    const href = hrefOf(result.current.initialEvents);
    expect(href).toContain(`/api/v1/embed/${SITE}/stylesheet?url=${encodeURIComponent(CSS)}&st=tok`);
    expect(href.startsWith(window.location.origin)).toBe(true);
  });

  it('leaves them alone without a token (an older core, or the demo)', async () => {
    const session = { replay_chunk_urls: [{ sequence: 0, url: 'https://r2.test/c0' }] };
    const { result } = renderHook(() => useReplayChunks(session, SITE));
    await waitFor(() => expect(result.current.initialEvents.length).toBe(1));
    expect(hrefOf(result.current.initialEvents)).toBe(CSS);
  });
});
