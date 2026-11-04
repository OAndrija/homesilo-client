import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE } from '../api';
import { FileMetadata, PageResponse } from '../models/file-metadata';

const FILES_URL = `${API_BASE}/files`;

@Injectable({ providedIn: 'root' })
export class Files {
  private http = inject(HttpClient);

  listActive(page = 0, size = 50): Observable<PageResponse<FileMetadata>> {
    return this.http.get<PageResponse<FileMetadata>>(FILES_URL, { params: pageParams(page, size) });
  }

  listRecentlyUploadedActive(page = 0, size = 10): Observable<PageResponse<FileMetadata>> {
    return this.http.get<PageResponse<FileMetadata>>(`${FILES_URL}/recent`, {
      params: pageParams(page, size),
    });
  }

  listTrashed(page = 0, size = 50): Observable<PageResponse<FileMetadata>> {
    return this.http.get<PageResponse<FileMetadata>>(`${FILES_URL}/trash`, {
      params: pageParams(page, size),
    });
  }

  listStarred(page = 0, size = 50): Observable<PageResponse<FileMetadata>> {
    return this.http.get<PageResponse<FileMetadata>>(`${FILES_URL}/starred`, {
      params: pageParams(page, size),
    });
  }

  searchActive(query: string, page = 0, size = 50): Observable<PageResponse<FileMetadata>> {
    return this.search(`${FILES_URL}/search`, query, page, size);
  }

  searchTrashed(query: string, page = 0, size = 50): Observable<PageResponse<FileMetadata>> {
    return this.search(`${FILES_URL}/trash/search`, query, page, size);
  }

  searchStarred(query: string, page = 0, size = 50): Observable<PageResponse<FileMetadata>> {
    return this.search(`${FILES_URL}/starred/search`, query, page, size);
  }

  upload(file: File, folderId: string | null = null): Observable<FileMetadata> {
    const formData = new FormData();
    formData.append('file', file);
    if (folderId) formData.append('folderId', folderId);
    return this.http.post<FileMetadata>(`${FILES_URL}/upload`, formData);
  }

  rename(fileId: string, name: string): Observable<FileMetadata> {
    return this.http.patch<FileMetadata>(`${FILES_URL}/${fileId}/rename`, { name });
  }

  moveFile(fileId: string, targetFolderId: string | null): Observable<FileMetadata> {
    return this.http.patch<FileMetadata>(`${FILES_URL}/${fileId}/move`, { targetFolderId });
  }

  trash(fileId: string): Observable<FileMetadata> {
    return this.http.patch<FileMetadata>(`${FILES_URL}/${fileId}/trash`, {});
  }

  toggleStar(fileId: string): Observable<FileMetadata> {
    return this.http.patch<FileMetadata>(`${FILES_URL}/${fileId}/star`, {});
  }

  restore(fileId: string): Observable<FileMetadata> {
    return this.http.patch<FileMetadata>(`${FILES_URL}/${fileId}/restore`, {});
  }

  deletePermanently(fileId: string): Observable<void> {
    return this.http.delete<void>(`${FILES_URL}/${fileId}`);
  }

  // URLs the browser fetches directly (with the session cookie), so large files
  // stream to disk or into a viewer instead of being buffered in JS memory.

  downloadUrl(fileId: string): string {
    return `${FILES_URL}/${encodeURIComponent(fileId)}/download`;
  }

  previewUrl(fileId: string): string {
    return `${FILES_URL}/${encodeURIComponent(fileId)}/preview`;
  }

  zipUrl(fileIds: string[], folderIds: string[]): string {
    const params = new HttpParams({ fromObject: { fileIds, folderIds } });
    return `${FILES_URL}/download-zip?${params.toString()}`;
  }

  private search(url: string, query: string, page: number, size: number) {
    return this.http.get<PageResponse<FileMetadata>>(url, {
      params: pageParams(page, size).set('query', query),
    });
  }
}

function pageParams(page: number, size: number): HttpParams {
  return new HttpParams().set('page', page).set('size', size);
}
