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
      isLoading: true, // Start with loading true until persisted state loads

      setAuth: ({ user, access_token, refresh_token, rememberMe = false }) =>
        set(() => ({
          user,
          // subscription, // Removed: Commercial subscription functionality
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

      // Initialize auth state after persistence loads
      initializeAuth: () =>
        set(() => ({
          isLoading: false,
        })),

      logout: () =>
        set(() => ({
          user: null,
          // subscription: null, // Removed: Commercial subscription functionality
          access_token: null,
          refresh_token: null,
          isAuthenticated: false,
          rememberMe: false,
          isLoading: false,
        })),

      resetAuth: () =>
        set(() => ({
          user: null,
          // subscription: null, // Removed: Commercial subscription functionality
          access_token: null,
          refresh_token: null,
          isAuthenticated: false,
          rememberMe: false,
          isLoading: false,
        })),

      // Check if token is expired
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

      // Get token expiration time
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
      partialize: (state) => ({
        user: state.user,
        // subscription: state.subscription, // Removed: Commercial subscription functionality
        access_token: state.access_token,
        refresh_token: state.refresh_token,
        isAuthenticated: state.isAuthenticated,
        rememberMe: state.rememberMe,
      }),
    }
  )
);
