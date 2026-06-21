import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { AuthResponse, LoginRequest, RegisterRequest } from '../models/auth.models';
import { Observable, tap } from 'rxjs';
import { DashboardStore } from './dashboard-store';

@Injectable({ providedIn: 'root' })
export class Auth {
  private http = inject(HttpClient);
  private router = inject(Router);
  private dashboardStore = inject(DashboardStore);

  private readonly TOKEN_KEY = 'auth_token';
  private readonly API = 'http://localhost:8080/api/v1/auth';

  register(request: RegisterRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.API}/register`, request)
      .pipe(tap((response) => this.saveToken(response.token)));
  }

  login(request: LoginRequest): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${this.API}/login`, request)
      .pipe(tap((response) => this.saveToken(response.token)));
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  getTokenPayload(): { sub: string; id: string } | null {
    const token = this.getToken();
    if (!token) return null;

    try {
      const payload = token.split('.')[1]; // grab the middle part
      const decoded = atob(payload); // Base64 decode it
      return JSON.parse(decoded); // parse the JSON
    } catch {
      return null; // malformed token
    }
  }

  isLoggedIn(): boolean {
    return this.getToken() !== null;
  }

  private saveToken(token: string): void {
    localStorage.setItem(this.TOKEN_KEY, token);
    this.dashboardStore.reset();
  }
}
