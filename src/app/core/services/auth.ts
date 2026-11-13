import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, map, Observable, of, switchMap } from 'rxjs';
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
import { PreferencesService } from './preferences';

/**
 * Session state. The token is an HttpOnly cookie the app never sees; the
 * current user is restored on startup from `/users/me`.
 */
@Injectable({ providedIn: 'root' })
export class Auth {
  private http = inject(HttpClient);
  private router = inject(Router);
  private dashboardStore = inject(DashboardStore);
  private preferences = inject(PreferencesService);

  private readonly userSignal = signal<User | null>(null);
  readonly user = this.userSignal.asReadonly();
  readonly isLoggedIn = computed(() => this.userSignal() !== null);
  readonly isAdmin = computed(() => this.userSignal()?.role === 'ADMIN');

  /** Called once by the app initializer; resolves either way so the app can boot. */
  restoreSession(): Observable<User | null> {
    return this.http.get<User>(`${API_BASE}/users/me`).pipe(
      catchError(() => of(null)),
      switchMap((user) => {
        this.userSignal.set(user);
        return user ? this.preferences.load(user.id).pipe(map(() => user)) : of(null);
      }),
    );
  }

  config(): Observable<AuthConfig> {
    return this.http.get<AuthConfig>(`${API_BASE}/auth/config`);
  }

  register(request: RegisterRequest): Observable<User> {
    return this.http
      .post<AuthResponse>(`${API_BASE}/auth/register`, request)
      .pipe(switchMap((response) => this.startSession(response)));
  }

  login(request: LoginRequest): Observable<User> {
    return this.http
      .post<AuthResponse>(`${API_BASE}/auth/login`, request)
      .pipe(switchMap((response) => this.startSession(response)));
  }

  /**
   * Ends the session on the server, then here. The request is sent with
   * `keepalive`, so it still reaches the server if the tab is closed or
   * reloaded right after clicking Sign out (an ordinary request would be
   * cancelled, leaving the session valid). HttpClient's XHR backend can't do
   * that, hence fetch, with the CSRF header the interceptor would have added.
   */
  logout(): Promise<void> {
    const token = readCookie('XSRF-TOKEN');
    return fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'same-origin',
      keepalive: true,
      headers: token ? { 'X-XSRF-TOKEN': token } : {},
    })
      .then(
        () => undefined,
        () => undefined, // offline: the cookie expires on its own; sign out here regardless
      )
      .finally(() => this.endSession());
  }

  changePassword(request: ChangePasswordRequest): Observable<void> {
    return this.http.put<void>(`${API_BASE}/users/me/password`, request);
  }

  /** The server rejected our cookie (expired, revoked, account disabled). */
  handleSessionExpired(): void {
    if (!this.userSignal()) return;
    this.endSession(this.router.url);
  }

  /** Signs in here, once this account's settings are in place, so the app opens in its own look. */
  private startSession(response: AuthResponse): Observable<User> {
    this.dashboardStore.reset();
    return this.preferences.load(response.user.id).pipe(
      map(() => {
        this.userSignal.set(response.user);
        return response.user;
      }),
    );
  }

  private endSession(returnUrl?: string): void {
    this.userSignal.set(null);
    this.preferences.clear();
    this.dashboardStore.reset();
    this.router.navigate(['/login'], returnUrl ? { queryParams: { returnUrl } } : {});
  }
}

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}
