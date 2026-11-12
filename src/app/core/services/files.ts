import { HttpClient, HttpEvent, HttpParams } from '@angular/common/http';
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

  /** Pictures from every folder, newest upload first. */
  listPhotos(page = 0, size = 24): Observable<PageResponse<FileMetadata>> {
    return this.http.get<PageResponse<FileMetadata>>(`${FILES_URL}/photos`, {
      params: pageParams(page, size),
    });
  }

  listTrashed(page = 0, size = 50, sort?: string): Observable<PageResponse<FileMetadata>> {
    return this.http.get<PageResponse<FileMetadata>>(`${FILES_URL}/trash`, {
      params: pageParams(page, size, sort),
    });
  }

  listStarred(page = 0, size = 50, sort?: string): Observable<PageResponse<FileMetadata>> {
    return this.http.get<PageResponse<FileMetadata>>(`${FILES_URL}/starred`, {
      params: pageParams(page, size, sort),
    });
  }

  searchActive(
    query: string,
    page = 0,
    size = 50,
    sort?: string,
  ): Observable<PageResponse<FileMetadata>> {
    return this.search(`${FILES_URL}/search`, query, page, size, sort);
  }

  searchTrashed(
    query: string,
    page = 0,
    size = 50,
    sort?: string,
  ): Observable<PageResponse<FileMetadata>> {
    return this.search(`${FILES_URL}/trash/search`, query, page, size, sort);
  }

  searchStarred(
    query: string,
    page = 0,
    size = 50,
    sort?: string,
  ): Observable<PageResponse<FileMetadata>> {
    return this.search(`${FILES_URL}/starred/search`, query, page, size, sort);
  }

  upload(file: File, folderId: string | null = null): Observable<FileMetadata> {
    const formData = new FormData();
    formData.append('file', file);
    if (folderId) formData.append('folderId', folderId);
    return this.http.post<FileMetadata>(`${FILES_URL}/upload`, formData);
  }

  /** Same as upload, but emits progress events so the upload panel can show a bar. */
  uploadWithProgress(
    file: File,
    folderId: string | null = null,
  ): Observable<HttpEvent<FileMetadata>> {
    const formData = new FormData();
    formData.append('file', file);
    if (folderId) formData.append('folderId', folderId);
    return this.http.post<FileMetadata>(`${FILES_URL}/upload`, formData, {
      observe: 'events',
      reportProgress: true,
    });
  }

  getMetadata(fileId: string): Observable<FileMetadata> {
    return this.http.get<FileMetadata>(`${FILES_URL}/${fileId}/metadata`);
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

  /** A small preview of an image; only for files whose `thumbnail` flag is set. */
  thumbnailUrl(fileId: string): string {
    return `${FILES_URL}/${encodeURIComponent(fileId)}/thumbnail`;
  }

  previewUrl(fileId: string): string {
    return `${FILES_URL}/${encodeURIComponent(fileId)}/preview`;
  }

  zipUrl(fileIds: string[], folderIds: string[]): string {
    const params = new HttpParams({ fromObject: { fileIds, folderIds } });
    return `${FILES_URL}/download-zip?${params.toString()}`;
  }

  private search(url: string, query: string, page: number, size: number, sort?: string) {
    return this.http.get<PageResponse<FileMetadata>>(url, {
      params: pageParams(page, size, sort).set('query', query),
    });
  }
}

function pageParams(page: number, size: number, sort?: string): HttpParams {
  const params = new HttpParams().set('page', page).set('size', size);
  return sort ? params.set('sort', sort) : params;
}
