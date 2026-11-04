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
  registrationEnabled: boolean;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}
