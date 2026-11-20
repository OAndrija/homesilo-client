import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Location } from '@angular/common';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
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

describe('Register with an invite link', () => {
  let http: HttpTestingController;
  let replaced: string[];

  function open(fragment: string | null) {
    replaced = [];
    TestBed.configureTestingModule({
      imports: [Register],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { data: { invite: true }, fragment } } },
        { provide: Location, useValue: { replaceState: (url: string) => replaced.push(url) } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const register = TestBed.createComponent(Register).componentInstance;
    return register;
  }

  afterEach(() => http.verify());

  it('checks the link, clears it from the address bar and signs up with it', () => {
    const register = open('secret-token');
    expect(replaced).toEqual(['/invite']);
    const preview = http.expectOne('/api/v1/auth/invites/preview');
    expect(preview.request.body).toEqual({ token: 'secret-token' });
    preview.flush({ invitedBy: 'owner', expiresAt: '2026-12-01T10:00:00' });
    http
      .expectOne('/api/v1/auth/config')
      .flush({ registrationEnabled: false, setupRequired: false });

    expect(register.invite()).toEqual({
      kind: 'valid',
      preview: { invitedBy: 'owner', expiresAt: '2026-12-01T10:00:00' },
    });
    expect(register.canSignUp()).toBe(true);

    register.form.setValue({ username: 'mum', email: 'mum@home.lan', password: 'long-enough' });
    register.onSubmit();
    const req = http.expectOne('/api/v1/auth/register');
    expect(req.request.body.inviteToken).toBe('secret-token');
  });

  it("can't sign up with a used or expired link", () => {
    const register = open('used-token');
    http
      .expectOne('/api/v1/auth/invites/preview')
      .flush(
        { detail: 'This invite link has expired or has already been used.' },
        { status: 404, statusText: 'Not Found' },
      );
    http
      .expectOne('/api/v1/auth/config')
      .flush({ registrationEnabled: false, setupRequired: false });
    expect(register.invite()).toEqual({
      kind: 'invalid',
      message: 'This invite link has expired or has already been used.',
    });
    expect(register.canSignUp()).toBe(false);
  });

  it('says so when the link is missing its secret', () => {
    const register = open(null);
    http
      .expectOne('/api/v1/auth/config')
      .flush({ registrationEnabled: true, setupRequired: false });
    expect(register.invite().kind).toBe('invalid');
    // Even on an open server: a broken invite link is worth pointing out.
    expect(register.canSignUp()).toBe(false);
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
