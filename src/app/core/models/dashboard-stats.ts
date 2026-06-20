import { FileMetadata } from './file-metadata';

export interface StorageBreakdownItem {
  category: string;
  bytes: number;
}

export interface DashboardStats {
  storageUsedBytes: number;
  storageQuotaBytes: number;
  totalFiles: number;
  filesThisWeek: number;
  storageBreakdown: StorageBreakdownItem[];
  recentlyTrashed: FileMetadata[];
}
