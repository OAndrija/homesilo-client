import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { User } from '../models/auth.models';
import { Auth } from './auth';
import { DashboardStore } from './dashboard-store';

const ALICE: User = {
  id: '1',
  username: 'alice',
  email: 'alice@example.com',
  role: 'ADMIN',
  enabled: true,
  createdAt: '2026-01-01T00:00:00',
  storageQuotaBytes: 1024,
};

describe('Auth', () => {
  let auth: Auth;
  let http: HttpTestingController;
  let router: Router;
  let store: DashboardStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    auth = TestBed.inject(Auth);
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    store = TestBed.inject(DashboardStore);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
    vi.spyOn(store, 'reset');
  });

  afterEach(() => http.verify());

  it('restores an existing session on startup', () => {
    auth.restoreSession().subscribe();
    http.expectOne('/api/v1/users/me').flush(ALICE);
    expect(auth.user()).toEqual(ALICE);
    expect(auth.isAdmin()).toBe(true);
  });

  it('starts signed out when there is no session', () => {
    let result: User | null | undefined;
    auth.restoreSession().subscribe((user) => (result = user));
    http.expectOne('/api/v1/users/me').flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(result).toBeNull();
    expect(auth.isLoggedIn()).toBe(false);
  });

  it('clears cached dashboard data when a new session starts', () => {
    auth.login({ username: 'alice', password: 'x' }).subscribe();
    http.expectOne('/api/v1/auth/login').flush({ user: ALICE, expiresInSeconds: 60 });
    expect(store.reset).toHaveBeenCalled();
    expect(auth.isLoggedIn()).toBe(true);
  });

  it('signs out locally even if the logout request fails', () => {
    auth.restoreSession().subscribe();
    http.expectOne('/api/v1/users/me').flush(ALICE);

    auth.logout();
    http.expectOne('/api/v1/auth/logout').flush(null, { status: 0, statusText: 'Network error' });

    expect(auth.user()).toBeNull();
    expect(router.navigate).toHaveBeenCalledWith(['/login'], {});
  });
});
