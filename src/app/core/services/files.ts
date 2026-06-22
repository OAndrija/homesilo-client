import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { FileMetadata, PageResponse } from '../models/file-metadata';

const API_URL = 'http://localhost:8080/api/v1/files';


@Injectable({ providedIn: 'root' })
export class Files {
  private http = inject(HttpClient);

  listActive(page = 0, size = 20): Observable<PageResponse<FileMetadata>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<PageResponse<FileMetadata>>(API_URL, { params });
  }

  listRecentlyUploadedActive(page = 0, size = 10): Observable<PageResponse<FileMetadata>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<PageResponse<FileMetadata>>(`${API_URL}/recent`, { params });
  }

  listTrashed(page = 0, size = 20): Observable<PageResponse<FileMetadata>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<PageResponse<FileMetadata>>(`${API_URL}/trash`, { params });
  }

  listStarred(page = 0, size = 20): Observable<PageResponse<FileMetadata>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<PageResponse<FileMetadata>>(`${API_URL}/starred`, { params });
  }

  upload(file: File): Observable<FileMetadata> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<FileMetadata>(`${API_URL}/upload`, formData);
  }

  download(fileId: string): Observable<Blob> {
    return this.http.get(`${API_URL}/${fileId}/download`, { responseType: 'blob' });
  }

  downloadZip(fileIds: string[]): Observable<Blob> {
    return this.http.post(`${API_URL}/download-zip`, fileIds, { responseType: 'blob' });
  }

  preview(fileId: string): Observable<Blob> {
    return this.http.get(`${API_URL}/${fileId}/preview`, { responseType: 'blob' });
  }

  trash(fileId: string): Observable<FileMetadata> {
    return this.http.patch<FileMetadata>(`${API_URL}/${fileId}/trash`, {});
  }

  toggleStar(fileId: string): Observable<FileMetadata> {
    return this.http.patch<FileMetadata>(`${API_URL}/${fileId}/star`, {});
  }

  restore(fileId: string): Observable<FileMetadata> {
    return this.http.patch<FileMetadata>(`${API_URL}/${fileId}/restore`, {});
  }

  deletePermanently(fileId: string): Observable<void> {
    return this.http.delete<void>(`${API_URL}/${fileId}`);
  }

  getStorageUsage(): Observable<number> {
    return this.http.get<number>(`${API_URL}/storage-usage`);
  }

  searchActive(query: string, page = 0, size = 20): Observable<PageResponse<FileMetadata>> {
    const params = new HttpParams().set('query', query).set('page', page).set('size', size);
    return this.http.get<PageResponse<FileMetadata>>(`${API_URL}/search`, { params });
  }

  searchTrashed(query: string, page = 0, size = 20): Observable<PageResponse<FileMetadata>> {
    const params = new HttpParams().set('query', query).set('page', page).set('size', size);
    return this.http.get<PageResponse<FileMetadata>>(`${API_URL}/trash/search`, { params });
  }

  searchStarred(query: string, page = 0, size = 20): Observable<PageResponse<FileMetadata>> {
    const params = new HttpParams().set('query', query).set('page', page).set('size', size);
    return this.http.get<PageResponse<FileMetadata>>(`${API_URL}/starred/search`, { params });
  }
}
