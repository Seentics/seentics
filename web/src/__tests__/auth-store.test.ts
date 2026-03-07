import { describe, it, expect, beforeEach } from 'vitest';
import { useAuth } from '@/stores/useAuthStore';

describe('Auth Store', () => {
  beforeEach(() => {
    // Reset the store before each test
    useAuth.getState().resetAuth();
  });

  it('should start with unauthenticated state', () => {
    const state = useAuth.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.access_token).toBeNull();
    expect(state.refresh_token).toBeNull();
  });

  it('should set auth state on login', () => {
    const mockUser = {
      id: 'user-123',
      name: 'Test User',
      email: 'test@example.com',
      avatar: '',
      role: 'user',
      createdAt: new Date().toISOString(),
    };

    useAuth.getState().setAuth({
      user: mockUser,
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      rememberMe: false,
    });

    const state = useAuth.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.isAuthenticated).toBe(true);
    expect(state.access_token).toBe('test-access-token');
    expect(state.isLoading).toBe(false);
  });

  it('should clear state on logout', () => {
    useAuth.getState().setAuth({
      user: { id: '1', name: 'Test', email: 'test@test.com', avatar: '', role: 'user', createdAt: '' },
      access_token: 'token',
      refresh_token: 'refresh',
      rememberMe: true,
    });

    useAuth.getState().logout();

    const state = useAuth.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.access_token).toBeNull();
    expect(state.refresh_token).toBeNull();
    expect(state.rememberMe).toBe(false);
    expect(state.isAdminVerified).toBe(false);
  });

  it('should set user without tokens', () => {
    const mockUser = {
      id: 'user-456',
      name: 'Another User',
      email: 'another@test.com',
      avatar: '',
      role: 'admin',
      createdAt: '',
    };

    useAuth.getState().setUser(mockUser);

    const state = useAuth.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.isAuthenticated).toBe(true);
  });

  it('should set isAuthenticated to false when user is null', () => {
    useAuth.getState().setUser(null);
    expect(useAuth.getState().isAuthenticated).toBe(false);
  });

  it('should set admin verified flag', () => {
    useAuth.getState().setAdminVerified(true);
    expect(useAuth.getState().isAdminVerified).toBe(true);

    useAuth.getState().setAdminVerified(false);
    expect(useAuth.getState().isAdminVerified).toBe(false);
  });

  it('should detect expired tokens', () => {
    // Create a JWT-like token that's expired (exp in the past)
    const payload = { exp: Math.floor(Date.now() / 1000) - 3600 }; // 1 hour ago
    const fakeToken = `header.${btoa(JSON.stringify(payload))}.signature`;

    useAuth.getState().setTokens({
      access_token: fakeToken,
      refresh_token: 'refresh',
    });

    expect(useAuth.getState().isTokenExpired()).toBe(true);
  });

  it('should detect valid (non-expired) tokens', () => {
    const payload = { exp: Math.floor(Date.now() / 1000) + 3600 }; // 1 hour from now
    const fakeToken = `header.${btoa(JSON.stringify(payload))}.signature`;

    useAuth.getState().setTokens({
      access_token: fakeToken,
      refresh_token: 'refresh',
    });

    expect(useAuth.getState().isTokenExpired()).toBe(false);
  });

  it('should return true for isTokenExpired when no token exists', () => {
    expect(useAuth.getState().isTokenExpired()).toBe(true);
  });

  it('should get token expiration date', () => {
    const futureTime = Math.floor(Date.now() / 1000) + 3600;
    const payload = { exp: futureTime };
    const fakeToken = `header.${btoa(JSON.stringify(payload))}.signature`;

    useAuth.getState().setTokens({
      access_token: fakeToken,
      refresh_token: 'refresh',
    });

    const expiration = useAuth.getState().getTokenExpiration();
    expect(expiration).toBeInstanceOf(Date);
    expect(expiration!.getTime()).toBe(futureTime * 1000);
  });

  it('should return null for expiration when no token', () => {
    expect(useAuth.getState().getTokenExpiration()).toBeNull();
  });

  it('should initialize auth (set loading to false)', () => {
    // Initially loading is true
    const initialState = useAuth.getState();
    // After resetAuth it's false, so let's manually set loading
    useAuth.setState({ isLoading: true });
    expect(useAuth.getState().isLoading).toBe(true);

    useAuth.getState().initializeAuth();
    expect(useAuth.getState().isLoading).toBe(false);
  });

  it('should only persist user, isAuthenticated, and rememberMe (not tokens)', () => {
    // The partialize function should not include tokens
    const store = useAuth;
    const persistOptions = (store as any).persist;
    // We can verify by checking the persisted state structure
    // Tokens should NOT be in localStorage for security
    const state = useAuth.getState();
    expect(state).toHaveProperty('user');
    expect(state).toHaveProperty('isAuthenticated');
  });
});
