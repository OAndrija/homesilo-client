import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { passwordStrength, Register } from './register';

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

describe('passwordStrength', () => {
  it('is 0 for an empty password and weak below the minimum length', () => {
    expect(passwordStrength('')).toBe(0);
    expect(passwordStrength('Ab1!')).toBe(1);
  });

  it('rewards length first, then a mix of character kinds', () => {
    expect(passwordStrength('abcdefgh')).toBe(1);
    expect(passwordStrength('abcdefgh1!')).toBe(2);
    expect(passwordStrength('abcdefghijkl')).toBe(2);
    expect(passwordStrength('abcdefghijk1!')).toBe(3);
    expect(passwordStrength('correct horse battery staple')).toBe(3);
    expect(passwordStrength('Correct horse battery staple 9')).toBe(4);
  });
});
