import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { errorMessage } from '../../../core/http/http-error';
import { Auth } from '../../../core/services/auth';
import { AuthShell } from '../auth-shell/auth-shell';

/** Mirrors the server-side rules in RegisterRequest. */
const USERNAME_PATTERN = /^[A-Za-z0-9._-]+$/;

const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];

/**
 * A rough guide, not a rule: length counts most, then a mix of character kinds.
 * 0 = empty, 1 = weak … 4 = strong.
 */
export function passwordStrength(password: string): number {
  if (!password) return 0;
  if (password.length < 8) return 1;
  let score = 1;
  if (password.length >= 12) score++;
  if (password.length >= 16) score++;
  const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  if (kinds >= 3) score++;
  return Math.min(score, 4);
}

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, AuthShell],
  templateUrl: './register.html',
  styleUrl: '../auth-form.css',
})
export class Register {
  private auth = inject(Auth);
  private router = inject(Router);

  form = new FormGroup({
    username: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(3),
        Validators.maxLength(64),
        Validators.pattern(USERNAME_PATTERN),
      ],
    }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.maxLength(255)],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(8), Validators.maxLength(128)],
    }),
  });

  submitted = false;
  showPassword = signal(false);

  private passwordValue = toSignal(this.form.controls.password.valueChanges, {
    initialValue: '',
  });
  strength = computed(() => {
    const level = passwordStrength(this.passwordValue());
    return { level, label: STRENGTH_LABELS[level] };
  });
  errorMessage = signal('');
  loading = signal(false);
  registrationOpen = signal(true);

  constructor() {
    this.auth.config().subscribe({
      next: (config) => this.registrationOpen.set(config.registrationEnabled),
    });
  }

  get username() {
    return this.form.controls.username;
  }
  get email() {
    return this.form.controls.email;
  }
  get password() {
    return this.form.controls.password;
  }

  onSubmit(): void {
    this.submitted = true;
    this.errorMessage.set('');
    if (this.form.invalid) return;

    this.loading.set(true);
    this.auth
      .register(this.form.getRawValue())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => this.router.navigate(['/home']),
        error: (err) =>
          this.errorMessage.set(errorMessage(err, 'Registration failed. Please try again.')),
      });
  }
}
