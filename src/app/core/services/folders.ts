import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE } from '../api';
import { PageResponse } from '../models/file-metadata';
import { Folder, FolderSummary, FolderContentsResponse } from '../models/folder';

const FOLDERS_URL = `${API_BASE}/folders`;

@Injectable({ providedIn: 'root' })
export class Folders {
  private http = inject(HttpClient);

  getRootContents(page = 0, size = 50, sort?: string): Observable<FolderContentsResponse> {
    return this.http.get<FolderContentsResponse>(`${FOLDERS_URL}/root`, {
      params: pageParams(page, size, sort),
    });
  }

  getFolderContents(
    folderId: string,
    page = 0,
    size = 50,
    sort?: string,
  ): Observable<FolderContentsResponse> {
    return this.http.get<FolderContentsResponse>(`${FOLDERS_URL}/${folderId}/contents`, {
      params: pageParams(page, size, sort),
    });
  }

  /** Folders, files and bytes inside a folder, at any depth. */
  summary(folderId: string): Observable<FolderSummary> {
    return this.http.get<FolderSummary>(`${FOLDERS_URL}/${folderId}/summary`);
  }

  search(query: string): Observable<Folder[]> {
    return this.http.get<Folder[]>(`${FOLDERS_URL}/search`, { params: { query } });
  }

  createFolder(name: string, parentId: string | null = null): Observable<Folder> {
    return this.http.post<Folder>(FOLDERS_URL, { name, parentId });
  }

  renameFolder(folderId: string, name: string): Observable<Folder> {
    return this.http.patch<Folder>(`${FOLDERS_URL}/${folderId}/rename`, { name });
  }

  moveFolder(folderId: string, targetParentId: string | null): Observable<Folder> {
    return this.http.patch<Folder>(`${FOLDERS_URL}/${folderId}/move`, { targetParentId });
  }

  /** Starred folders (not in trash), by name; `query` narrows them like search. */
  listStarred(query?: string): Observable<Folder[]> {
    return this.http.get<Folder[]>(`${FOLDERS_URL}/starred`, {
      params: query ? { query } : {},
    });
  }

  toggleStar(folderId: string): Observable<Folder> {
    return this.http.patch<Folder>(`${FOLDERS_URL}/${folderId}/star`, {});
  }

  trashFolder(folderId: string): Observable<Folder> {
    return this.http.patch<Folder>(`${FOLDERS_URL}/${folderId}/trash`, {});
  }

  restoreFolder(folderId: string): Observable<Folder> {
    return this.http.patch<Folder>(`${FOLDERS_URL}/${folderId}/restore`, {});
  }

  deleteFolder(folderId: string): Observable<void> {
    return this.http.delete<void>(`${FOLDERS_URL}/${folderId}`);
  }

  listTrashed(page = 0, size = 50): Observable<PageResponse<Folder>> {
    return this.http.get<PageResponse<Folder>>(`${FOLDERS_URL}/trash`, {
      params: pageParams(page, size),
    });
  }
}

function pageParams(page: number, size: number, sort?: string): HttpParams {
  const params = new HttpParams().set('page', page).set('size', size);
  return sort ? params.set('sort', sort) : params;
}
