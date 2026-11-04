import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE } from '../api';
import { PurgeResult } from '../models/trash';

@Injectable({ providedIn: 'root' })
export class TrashApi {
  private http = inject(HttpClient);

  /** Permanently deletes everything in trash in one server-side transaction. */
  empty(): Observable<PurgeResult> {
    return this.http.delete<PurgeResult>(`${API_BASE}/trash`);
  }
}
