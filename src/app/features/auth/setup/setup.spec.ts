import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Setup } from './setup';

describe('Setup', () => {
  let http: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    localStorage.setItem('hs-prefs-claimed', '1');
    TestBed.configureTestingModule({
      imports: [Setup],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
  });

  afterEach(() => http.verify());

  function fill(setup: Setup) {
    setup.form.setValue({
      setupCode: 'ABCD-EFGH-2345',
      username: 'owner',
      email: 'owner@home.lan',
      password: 'owner-password',
    });
  }

  it('needs the setup code', () => {
    const setup = TestBed.createComponent(Setup).componentInstance;
    fill(setup);
    setup.form.controls.setupCode.setValue('');
    setup.onSubmit();
    http.expectNone('/api/v1/auth/setup');
  });

  it('creates the admin and opens the dashboard', () => {
    const setup = TestBed.createComponent(Setup).componentInstance;
    fill(setup);
    setup.onSubmit();
    const req = http.expectOne('/api/v1/auth/setup');
    expect(req.request.body.setupCode).toBe('ABCD-EFGH-2345');
    req.flush({ user: { id: 'u1', username: 'owner', role: 'ADMIN' }, expiresInSeconds: 60 });
    http.expectOne('/api/v1/users/me/preferences').flush({ values: {}, updatedAt: null });
    expect(navigate).toHaveBeenCalledWith(['/home']);
  });

  it('shows the reason for a wrong code', () => {
    const setup = TestBed.createComponent(Setup).componentInstance;
    fill(setup);
    setup.onSubmit();
    http
      .expectOne('/api/v1/auth/setup')
      .flush(
        { detail: "That setup code isn't right." },
        { status: 400, statusText: 'Bad Request' },
      );
    expect(setup.errorMessage()).toBe("That setup code isn't right.");
  });

  it('goes to sign-in if someone else finished setup meanwhile', () => {
    const setup = TestBed.createComponent(Setup).componentInstance;
    fill(setup);
    setup.onSubmit();
    http
      .expectOne('/api/v1/auth/setup')
      .flush({ detail: 'Already set up' }, { status: 409, statusText: 'Conflict' });
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });
});
