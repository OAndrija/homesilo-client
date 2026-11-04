import { FileMetadata } from './file-metadata';

export interface StorageBreakdownItem {
  category: string;
  bytes: number;
}

export interface DashboardStats {
  /** Everything counted against the quota, trash included. */
  storageUsedBytes: number;
  storageQuotaBytes: number;
  /** The part of `storageUsedBytes` that is in trash. */
  trashedBytes: number;
  totalFiles: number;
  totalFolders: number;
  filesThisWeek: number;
  starredCount: number;
  /** Days before trashed items are purged; 0 means never. */
  trashRetentionDays: number;
  storageBreakdown: StorageBreakdownItem[];
  recentlyTrashed: FileMetadata[];
}
