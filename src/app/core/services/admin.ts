import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE } from '../api';
import { AdminOverview, AdminUser, NewUser, UserChanges, UserFilters } from '../models/admin';
import { PageResponse } from '../models/file-metadata';

const ADMIN_URL = `${API_BASE}/admin`;

/** Account management; every call needs the admin role. */
@Injectable({ providedIn: 'root' })
export class AdminApi {
  private http = inject(HttpClient);

  overview(): Observable<AdminOverview> {
    return this.http.get<AdminOverview>(`${ADMIN_URL}/overview`);
  }

  listUsers(
    filters: UserFilters,
    page = 0,
    size = 25,
    sort = 'username,asc',
  ): Observable<PageResponse<AdminUser>> {
    let params = new HttpParams().set('page', page).set('size', size).set('sort', sort);
    if (filters.query.trim()) params = params.set('query', filters.query.trim());
    if (filters.role) params = params.set('role', filters.role);
    if (filters.status) params = params.set('status', filters.status);
    return this.http.get<PageResponse<AdminUser>>(`${ADMIN_URL}/users`, { params });
  }

  createUser(user: NewUser): Observable<AdminUser> {
    return this.http.post<AdminUser>(`${ADMIN_URL}/users`, user);
  }

  updateUser(id: string, changes: UserChanges): Observable<AdminUser> {
    return this.http.patch<AdminUser>(`${ADMIN_URL}/users/${id}`, changes);
  }

  resetPassword(id: string, newPassword: string): Observable<void> {
    return this.http.put<void>(`${ADMIN_URL}/users/${id}/password`, { newPassword });
  }

  deleteUser(id: string): Observable<void> {
    return this.http.delete<void>(`${ADMIN_URL}/users/${id}`);
  }
}
