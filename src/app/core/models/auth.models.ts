export type UserRole = 'ADMIN' | 'USER';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  enabled: boolean;
  createdAt: string;
  storageQuotaBytes: number;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  /** From an invite link; needed when sign-up is closed. */
  inviteToken?: string;
}

/** The first admin account, with the setup code from the server log. */
export interface SetupRequest {
  setupCode: string;
  username: string;
  email: string;
  password: string;
}

/** `username` accepts either the username or the email address. */
export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  user: User;
  expiresInSeconds: number;
}

export interface AuthConfig {
  /** Anyone can sign up, without an invite. */
  registrationEnabled: boolean;
  /** Nobody has an account yet: the admin is created with the setup code. */
  setupRequired: boolean;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}
