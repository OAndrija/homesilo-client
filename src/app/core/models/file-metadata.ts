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
  folderId: string | null;
  folderName: string | null;
  /** The server can show a small preview (GET /files/{id}/thumbnail). */
  thumbnail: boolean;
}

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  last: boolean;
}
