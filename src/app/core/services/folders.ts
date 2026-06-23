import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Folder, FolderContentsResponse } from '../models/folder';

const API_URL = 'http://localhost:8080/api/v1/folders';

@Injectable({ providedIn: 'root' })
export class Folders {
  private http = inject(HttpClient);

  getRootContents(page = 0, size = 20): Observable<FolderContentsResponse> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<FolderContentsResponse>(`${API_URL}/root`, { params });
  }

  getFolderContents(folderId: string, page = 0, size = 20): Observable<FolderContentsResponse> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<FolderContentsResponse>(`${API_URL}/${folderId}/contents`, { params });
  }

  createFolder(name: string, parentId: string | null = null): Observable<Folder> {
    return this.http.post<Folder>(API_URL, { name, parentId });
  }

  renameFolder(folderId: string, name: string): Observable<Folder> {
    return this.http.patch<Folder>(`${API_URL}/${folderId}/rename`, { name });
  }

  trashFolder(folderId: string): Observable<Folder> {
    return this.http.patch<Folder>(`${API_URL}/${folderId}/trash`, {});
  }

  restoreFolder(folderId: string): Observable<Folder> {
    return this.http.patch<Folder>(`${API_URL}/${folderId}/restore`, {});
  }

  deleteFolder(folderId: string): Observable<void> {
    return this.http.delete<void>(`${API_URL}/${folderId}`);
  }

  moveFolder(folderId: string, targetParentId: string | null): Observable<Folder> {
    return this.http.patch<Folder>(`${API_URL}/${folderId}/move`, { targetParentId });
  }
}
