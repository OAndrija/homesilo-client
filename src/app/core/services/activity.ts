import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE } from '../api';
import { ActivityEntry, ActivityFilters } from '../models/activity';
import { PageResponse } from '../models/file-metadata';

@Injectable({ providedIn: 'root' })
export class ActivityApi {
  private http = inject(HttpClient);

  /** The whole server's log, newest first. Admins only. */
  serverActivity(
    filters: ActivityFilters,
    page = 0,
    size = 50,
  ): Observable<PageResponse<ActivityEntry>> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (filters.query.trim()) params = params.set('query', filters.query.trim());
    if (filters.category) params = params.set('category', filters.category);
    if (filters.userId) params = params.set('userId', filters.userId);
    return this.http.get<PageResponse<ActivityEntry>>(`${API_BASE}/admin/activity`, { params });
  }

  /** The signed-in person's account history: sign-ins, password and admin changes. */
  myActivity(page = 0, size = 10): Observable<PageResponse<ActivityEntry>> {
    return this.http.get<PageResponse<ActivityEntry>>(`${API_BASE}/users/me/activity`, {
      params: new HttpParams().set('page', page).set('size', size),
    });
  }
}
