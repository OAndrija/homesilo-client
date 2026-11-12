import { UserRole } from './auth.models';

/** One account as the admin's user list shows it. */
export interface AdminUser {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  enabled: boolean;
  createdAt: string;
  /** Null if they have never signed in. */
  lastLoginAt: string | null;
  storageQuotaBytes: number;
  /** Trash included, like the quota check. */
  storageUsedBytes: number;
  /** Files outside the trash. */
  fileCount: number;
}

export interface StorageByUser {
  id: string;
  username: string;
  bytes: number;
}

export interface AdminOverview {
  users: number;
  activeUsers: number;
  admins: number;
  storageUsedBytes: number;
  /** The sum of every account's storage limit. */
  storageAllocatedBytes: number;
  files: number;
  defaultQuotaBytes: number;
  registrationEnabled: boolean;
  topUsers: StorageByUser[];
}

export type AccountStatus = 'ACTIVE' | 'DISABLED';

export interface UserFilters {
  query: string;
  role: UserRole | null;
  status: AccountStatus | null;
}

export interface NewUser {
  username: string;
  email: string;
  password: string;
  role: UserRole;
  storageQuotaBytes: number;
}

export interface UserChanges {
  enabled?: boolean;
  role?: UserRole;
  storageQuotaBytes?: number;
}
