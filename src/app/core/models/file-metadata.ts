export interface FileMetadata {
  id: string;
  originalFileName: string;
  contentType: string;
  size: number;
  trashed: boolean;
  starred: boolean;
  uploadedAt: string;
  lastModified: string;
  trashedAt: string | null;
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}
