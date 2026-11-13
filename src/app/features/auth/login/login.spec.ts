import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter, Router } from '@angular/router';
import { Login } from './login';

describe('Login', () => {
  let http: HttpTestingController;
  let router: Router;

  function create(returnUrl?: string) {
    TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: { queryParamMap: convertToParamMap(returnUrl ? { returnUrl } : {}) },
          },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    return TestBed.createComponent(Login).componentInstance;
  }

  afterEach(() => http.verify());

  it('does not call the API when the form is empty', () => {
    const login = create();
    login.onSubmit();
    http.expectNone('/api/v1/auth/login');
  });

  it('shows the server problem detail on failure', () => {
    const login = create();
    login.form.setValue({ username: 'alice', password: 'wrong' });
    login.onSubmit();

    http
      .expectOne('/api/v1/auth/login')
      .flush(
        { detail: 'Invalid username or password', status: 401 },
        { status: 401, statusText: 'Unauthorized' },
      );

    expect(login.errorMessage()).toBe('Invalid username or password');
    expect(login.loading()).toBe(false);
  });

  it('returns to the requested in-app page after signing in', () => {
    const login = create('/my-files?folderId=abc');
    login.form.setValue({ username: 'alice', password: 'secret' });
    login.onSubmit();
    http
      .expectOne('/api/v1/auth/login')
      .flush({ user: { id: '1', username: 'alice' }, expiresInSeconds: 60 });
    http.expectOne('/api/v1/users/me/preferences').flush({ values: {}, updatedAt: null });

    expect(router.navigateByUrl).toHaveBeenCalledWith('/my-files?folderId=abc');
  });

  it('ignores return URLs that point to another site', () => {
    const login = create('//evil.example.com');
    login.form.setValue({ username: 'alice', password: 'secret' });
    login.onSubmit();
    http
      .expectOne('/api/v1/auth/login')
      .flush({ user: { id: '1', username: 'alice' }, expiresInSeconds: 60 });
    http.expectOne('/api/v1/users/me/preferences').flush({ values: {}, updatedAt: null });

    expect(router.navigateByUrl).toHaveBeenCalledWith('/home');
  });
});
