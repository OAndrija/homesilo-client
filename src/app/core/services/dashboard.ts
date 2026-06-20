import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DashboardStats } from '../models/dashboard-stats';

const API_URL = 'http://localhost:8080/api/v1/dashboard';

@Injectable({ providedIn: 'root' })
export class Dashboard {
  private http = inject(HttpClient);

  getStats(): Observable<DashboardStats> {
    return this.http.get<DashboardStats>(`${API_URL}/stats`);
  }
}
