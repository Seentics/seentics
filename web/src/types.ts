export type User = {
  email: string
  name: string
  avatar: string | null
  isEmailVerified: boolean
  isActive: boolean
  loginCount: number
  _id: string
  id: string
  lastLoginAt: string
  createdAt: string
  updatedAt: string
  role?: string
  /** `client` for an agency's client user (magic-link sign-in); accounts are `account` or absent. */
  kind?: 'account' | 'client'
  /** A client user's agency: its owner account and its sign-in name. */
  agency?: { owner_id: string; slug: string | null }
  // OAuth fields
  googleId?: string
  githubId?: string
  // Helper methods
  isOAuthUser?: () => boolean
  getOAuthProvider?: () => string
}

export type AuthState = {
  user: User | null
  access_token: string | null
  refresh_token: string | null
  isAuthenticated: boolean
  rememberMe: boolean
  isLoading: boolean
  isAdminVerified: boolean
  setAuth: (data: {
    user: User
    access_token: string
    refresh_token: string
    rememberMe?: boolean
  }) => void
  setUser: (user: User) => void
  setTokens: (data: { access_token: string; refresh_token: string }) => void
  setRememberMe: (rememberMe: boolean) => void
  setLoading: (isLoading: boolean) => void
  initializeAuth: () => void
  logout: () => void
  resetAuth: () => void
  isTokenExpired: () => boolean
  getTokenExpiration: () => Date | null
  setAdminVerified: (verified: boolean) => void
}
