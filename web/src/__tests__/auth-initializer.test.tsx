import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import AuthInitializer from '@/components/auth-initializer';
import { useAuth } from '@/stores/useAuthStore';

/**
 * Sign-in lives on another origin, so a browser that just signed in arrives here with
 * the gateway's session cookie and nothing in this app's localStorage. The initializer
 * has to find the session through the cookie — without that, the dashboard sent every
 * such browser back to the sign-in page in a loop.
 */

const user = { id: 'user-1', name: 'Demo User', email: 'demo@seentics.local' };

describe('AuthInitializer', () => {
  beforeEach(() => {
    useAuth.getState().resetAuth();
    useAuth.setState({ isLoading: true });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('signs in from the cookie session when nothing was persisted', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ success: true, data: { user } }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    render(<AuthInitializer />);

    await waitFor(() => expect(useAuth.getState().isLoading).toBe(false));
    expect(useAuth.getState().user).toEqual(user);
    expect(useAuth.getState().isAuthenticated).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain('/user/auth/me');
    expect(init.credentials).toBe('include');
  });

  it('finishes signed out, without redirecting, when there is no session', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"unauthorized"}', { status: 401 })));

    render(<AuthInitializer />);

    await waitFor(() => expect(useAuth.getState().isLoading).toBe(false));
    expect(useAuth.getState().user).toBeNull();
    expect(useAuth.getState().isAuthenticated).toBe(false);
  });

  it('does not ask the gateway when a user was persisted', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    useAuth.setState({ user: user as never, isAuthenticated: true, isLoading: true });

    render(<AuthInitializer />);

    await waitFor(() => expect(useAuth.getState().isLoading).toBe(false));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
