export interface FileMetadata {
  id: string;
  originalFileName: string;
  contentType: string;
  size: number;
  trashed: boolean;
  uploadedAt: string;
  lastModified: string;
  trashedAt: string;
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}
