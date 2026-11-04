import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Auth } from '../services/auth';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  const auth = { handleSessionExpired: vi.fn() };

  beforeEach(() => {
    auth.handleSessionExpired.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: Auth, useValue: auth },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
  });

  afterEach(() => controller.verify());

  it('ends the session when an API call returns 401', () => {
    http.get('/api/v1/files').subscribe({ error: () => {} });
    controller.expectOne('/api/v1/files').flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(auth.handleSessionExpired).toHaveBeenCalledOnce();
  });

  it('treats 401 from session probes and sign-in as a normal answer', () => {
    http.get('/api/v1/users/me').subscribe({ error: () => {} });
    http.post('/api/v1/auth/login', {}).subscribe({ error: () => {} });
    controller
      .expectOne('/api/v1/users/me')
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    controller
      .expectOne('/api/v1/auth/login')
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    expect(auth.handleSessionExpired).not.toHaveBeenCalled();
  });

  it('leaves other errors alone', () => {
    http.get('/api/v1/files').subscribe({ error: () => {} });
    controller.expectOne('/api/v1/files').flush(null, { status: 500, statusText: 'Server Error' });
    expect(auth.handleSessionExpired).not.toHaveBeenCalled();
  });
});
