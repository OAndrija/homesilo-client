import { FileMetadata, PageResponse } from './file-metadata';

export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  parentName: string | null;
  trashed: boolean;
  trashedAt: string | null;
  createdAt: string;
  lastModified: string;
}

export interface FolderContentsResponse {
  folder: Folder | null; // null at root
  breadcrumb: Folder[];
  subfolders: Folder[];
  files: PageResponse<FileMetadata>;
}
