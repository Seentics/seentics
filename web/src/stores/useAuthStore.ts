import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthState, User } from '@/types';

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      subscription: null,
      access_token: null,
      refresh_token: null,
      isAuthenticated: false,
      rememberMe: false,
      isLoading: true,
      isAdminVerified: false,

      setAdminVerified: (isAdminVerified: boolean) => set({ isAdminVerified }),

      setAuth: ({ user, access_token, refresh_token, rememberMe = false }) =>
        set(() => ({
          user,
          access_token,
          refresh_token,
          isAuthenticated: true,
          rememberMe,
          isLoading: false,
        })),

      setUser: (user) =>
        set(() => ({
          user,
          isAuthenticated: !!user,
        })),

      setTokens: ({ access_token, refresh_token }) =>
        set(() => ({
          access_token,
          refresh_token,
          isAuthenticated: true,
        })),

      setRememberMe: (rememberMe) =>
        set(() => ({
          rememberMe,
        })),

      setLoading: (isLoading) =>
        set(() => ({
          isLoading,
        })),

      initializeAuth: () =>
        set(() => ({
          isLoading: false,
        })),

      logout: () =>
        set(() => ({
          user: null,
          access_token: null,
          refresh_token: null,
          isAuthenticated: false,
          rememberMe: false,
          isLoading: false,
          isAdminVerified: false,
        })),

      resetAuth: () =>
        set(() => ({
          user: null,
          access_token: null,
          refresh_token: null,
          isAuthenticated: false,
          rememberMe: false,
          isLoading: false,
          isAdminVerified: false,
        })),

      isTokenExpired: () => {
        const { access_token } = get();
        if (!access_token) return true;

        try {
          const payload = JSON.parse(atob(access_token.split('.')[1]));
          return payload.exp * 1000 < Date.now();
        } catch {
          return true;
        }
      },

      getTokenExpiration: () => {
        const { access_token } = get();
        if (!access_token) return null;

        try {
          const payload = JSON.parse(atob(access_token.split('.')[1]));
          return new Date(payload.exp * 1000);
        } catch {
          return null;
        }
      },
    }),
    {
      name: 'auth-storage',
      // Only persist user info and auth state — tokens are in httpOnly cookies
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        rememberMe: state.rememberMe,
      }),
    }
  )
);
