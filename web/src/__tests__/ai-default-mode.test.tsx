import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const status = vi.fn<() => Promise<{ configured: boolean }>>();
vi.mock('@/features/ai/api', () => ({ aiApi: { status: () => status() } }));

import {
  nextExplicitMode, readStoredMode, resolveDefaultMode, useDefaultMode,
  useDefaultModeRedirect, writeDefaultMode,
} from '@/features/ai/default-mode';

const KEY = 'seentics:default-mode:site-1';

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  localStorage.clear();
  status.mockReset();
});
afterEach(() => localStorage.clear());

describe('resolveDefaultMode', () => {
  it('honours an explicit choice whatever AI status says', () => {
    expect(resolveDefaultMode('dashboard', true)).toBe('dashboard');
    expect(resolveDefaultMode('ai', false)).toBe('ai');
    expect(resolveDefaultMode('ai', undefined)).toBe('ai');
  });

  it('defaults to AI when configured and nothing was chosen', () => {
    expect(resolveDefaultMode(null, true)).toBe('ai');
    expect(resolveDefaultMode(null, false)).toBe('dashboard');
  });

  it('waits for AI status when nothing was chosen', () => {
    expect(resolveDefaultMode(null, undefined)).toBe('pending');
  });
});

describe('stored choice', () => {
  it('treats an absent (legacy) key and unknown values as not chosen', () => {
    expect(readStoredMode('site-1')).toBeNull();
    localStorage.setItem(KEY, 'something-else');
    expect(readStoredMode('site-1')).toBeNull();
  });

  it('stores both choices explicitly', () => {
    writeDefaultMode('site-1', 'dashboard');
    expect(localStorage.getItem(KEY)).toBe('dashboard');
    expect(readStoredMode('site-1')).toBe('dashboard');
    writeDefaultMode('site-1', 'ai');
    expect(readStoredMode('site-1')).toBe('ai');
  });

  it('toggles to the opposite of what is in effect', () => {
    expect(nextExplicitMode('ai')).toBe('dashboard');
    expect(nextExplicitMode('dashboard')).toBe('ai');
  });
});

describe('useDefaultModeRedirect', () => {
  it('redirects to AI mode when configured and not chosen', async () => {
    status.mockResolvedValue({ configured: true });
    const replace = vi.fn();
    const { result } = renderHook(() => useDefaultModeRedirect('site-1', replace), { wrapper });
    expect(result.current.pending).toBe(true);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/websites/site-1/ai'));
    // Stays pending: the dashboard is not shown on the way out.
    expect(result.current.pending).toBe(true);
  });

  it('stays on the dashboard when AI is not configured', async () => {
    status.mockResolvedValue({ configured: false });
    const replace = vi.fn();
    const { result } = renderHook(() => useDefaultModeRedirect('site-1', replace), { wrapper });
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(replace).not.toHaveBeenCalled();
  });

  it('respects an explicit dashboard choice without asking for status', async () => {
    localStorage.setItem(KEY, 'dashboard');
    const replace = vi.fn();
    const { result } = renderHook(() => useDefaultModeRedirect('site-1', replace), { wrapper });
    await waitFor(() => expect(result.current.pending).toBe(false));
    expect(replace).not.toHaveBeenCalled();
    expect(status).not.toHaveBeenCalled();
  });

  it('follows an explicit AI choice without waiting for status', async () => {
    localStorage.setItem(KEY, 'ai');
    status.mockReturnValue(new Promise(() => {}));
    const replace = vi.fn();
    renderHook(() => useDefaultModeRedirect('site-1', replace), { wrapper });
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/websites/site-1/ai'));
  });

  it('never redirects when skipped (?dashboard=1, embed) or on the demo', async () => {
    localStorage.setItem(KEY, 'ai');
    localStorage.setItem('seentics:default-mode:demo', 'ai');
    status.mockResolvedValue({ configured: true });
    const replace = vi.fn();
    const skipped = renderHook(() => useDefaultModeRedirect('site-1', replace, true), { wrapper });
    const demo = renderHook(() => useDefaultModeRedirect('demo', replace), { wrapper });
    expect(skipped.result.current.pending).toBe(false);
    expect(demo.result.current.pending).toBe(false);
    await new Promise((r) => setTimeout(r, 20));
    expect(replace).not.toHaveBeenCalled();
  });
});

describe('useDefaultMode', () => {
  it('shows AI as the default when configured and flips to an explicit dashboard choice', async () => {
    status.mockResolvedValue({ configured: true });
    const { result } = renderHook(() => useDefaultMode('site-1'), { wrapper });
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.isDefaultAi).toBe(true);

    result.current.toggle();
    await waitFor(() => expect(result.current.isDefaultAi).toBe(false));
    expect(localStorage.getItem(KEY)).toBe('dashboard');

    result.current.toggle();
    await waitFor(() => expect(result.current.isDefaultAi).toBe(true));
    expect(localStorage.getItem(KEY)).toBe('ai');
  });
});
