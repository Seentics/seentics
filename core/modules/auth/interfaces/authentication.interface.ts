import type { FrontendUser } from "./auth.interface";
import type { UserRow } from "./user-repository.interface";

export type RegisterUserInput = {
  email: string;
  password: string;
  name: string;
};

export type LoginUserInput = {
  email: string;
  password: string;
};

export type AuthTokens = { access_token: string; refresh_token: string };
export type AuthResult = { data: { user: FrontendUser; tokens: AuthTokens } };

export interface CredentialAuthentication {
  register(input: RegisterUserInput): Promise<AuthResult>;
  login(input: LoginUserInput): Promise<AuthResult>;
  refresh(refreshToken: string): Promise<AuthTokens>;
  changePassword(userId: string, currentPassword: string, newPassword: string): Promise<PasswordChangeResult>;
}

/** A signed-in user replacing their password — the one write peers may ask auth for. */
export type PasswordChangeResult = "changed" | "bad-current" | "invalid-new" | "not-found";
export interface PasswordChanger {
  changePassword(userId: string, currentPassword: string, newPassword: string): Promise<PasswordChangeResult>;
}

export interface AuthAccountQuery {
  countUsers(): Promise<number>;
  getById(userId: string): Promise<UserRow | null>;
}
