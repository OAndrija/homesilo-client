import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Register } from './register';

describe('Register', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [Register],
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reflects a closed registration from the server config', () => {
    const register = TestBed.createComponent(Register).componentInstance;
    http.expectOne('/api/v1/auth/config').flush({ registrationEnabled: false });
    expect(register.registrationOpen()).toBe(false);
  });

  it('applies the same username and password rules as the server', () => {
    const register = TestBed.createComponent(Register).componentInstance;
    http.expectOne('/api/v1/auth/config').flush({ registrationEnabled: true });

    register.form.setValue({ username: 'no spaces!', email: 'a@b.co', password: 'short' });
    expect(register.username.hasError('pattern')).toBe(true);
    expect(register.password.hasError('minlength')).toBe(true);

    register.form.setValue({ username: 'alice.b', email: 'a@b.co', password: 'long-enough' });
    expect(register.form.valid).toBe(true);
  });
});
