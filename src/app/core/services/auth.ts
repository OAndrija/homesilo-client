import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, finalize, map, Observable, of, tap } from 'rxjs';
import { API_BASE } from '../api';
import {
  AuthConfig,
  AuthResponse,
  ChangePasswordRequest,
  LoginRequest,
  RegisterRequest,
  User,
} from '../models/auth.models';
import { DashboardStore } from './dashboard-store';

/**
 * Session state. The token is an HttpOnly cookie the app never sees; the
 * current user is restored on startup from `/users/me`.
 */
@Injectable({ providedIn: 'root' })
export class Auth {
  private http = inject(HttpClient);
  private router = inject(Router);
  private dashboardStore = inject(DashboardStore);

  private readonly userSignal = signal<User | null>(null);
  readonly user = this.userSignal.asReadonly();
  readonly isLoggedIn = computed(() => this.userSignal() !== null);
  readonly isAdmin = computed(() => this.userSignal()?.role === 'ADMIN');

  /** Called once by the app initializer; resolves either way so the app can boot. */
  restoreSession(): Observable<User | null> {
    return this.http.get<User>(`${API_BASE}/users/me`).pipe(
      catchError(() => of(null)),
      tap((user) => this.userSignal.set(user)),
    );
  }

  config(): Observable<AuthConfig> {
    return this.http.get<AuthConfig>(`${API_BASE}/auth/config`);
  }

  register(request: RegisterRequest): Observable<User> {
    return this.http
      .post<AuthResponse>(`${API_BASE}/auth/register`, request)
      .pipe(map((response) => this.startSession(response)));
  }

  login(request: LoginRequest): Observable<User> {
    return this.http
      .post<AuthResponse>(`${API_BASE}/auth/login`, request)
      .pipe(map((response) => this.startSession(response)));
  }

  logout(): void {
    this.http
      .post<void>(`${API_BASE}/auth/logout`, {})
      .pipe(
        catchError(() => of(undefined)),
        finalize(() => this.endSession()),
      )
      .subscribe();
  }

  changePassword(request: ChangePasswordRequest): Observable<void> {
    return this.http.put<void>(`${API_BASE}/users/me/password`, request);
  }

  /** The server rejected our cookie (expired, revoked, account disabled). */
  handleSessionExpired(): void {
    if (!this.userSignal()) return;
    this.endSession(this.router.url);
  }

  private startSession(response: AuthResponse): User {
    this.dashboardStore.reset();
    this.userSignal.set(response.user);
    return response.user;
  }

  private endSession(returnUrl?: string): void {
    this.userSignal.set(null);
    this.dashboardStore.reset();
    this.router.navigate(['/login'], returnUrl ? { queryParams: { returnUrl } } : {});
  }
}
