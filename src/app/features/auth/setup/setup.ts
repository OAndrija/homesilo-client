import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { errorMessage } from '../../../core/http/http-error';
import { Auth } from '../../../core/services/auth';
import { AuthShell } from '../auth-shell/auth-shell';
import { passwordStrength } from '../register/register';

const USERNAME_PATTERN = /^[A-Za-z0-9._-]+$/;
const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];

/**
 * A new server's first page: creating the admin account. The setup code from
 * the server log proves it's the server's owner doing it, not whoever found it first.
 */
@Component({
  selector: 'app-setup',
  imports: [ReactiveFormsModule, AuthShell],
  templateUrl: './setup.html',
  styleUrl: '../auth-form.css',
})
export class Setup {
  private auth = inject(Auth);
  private router = inject(Router);

  form = new FormGroup({
    setupCode: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(64)],
    }),
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
  errorMessage = signal('');
  loading = signal(false);

  private passwordValue = toSignal(this.form.controls.password.valueChanges, {
    initialValue: '',
  });
  strength = computed(() => {
    const level = passwordStrength(this.passwordValue());
    return { level, label: STRENGTH_LABELS[level] };
  });

  get setupCode() {
    return this.form.controls.setupCode;
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
      .setUp(this.form.getRawValue())
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => this.router.navigate(['/home']),
        error: (err) => {
          // Someone finished setup in the meantime: nothing to do here any more.
          if (err?.status === 409) {
            void this.router.navigate(['/login']);
            return;
          }
          this.errorMessage.set(errorMessage(err, 'Setup failed. Please try again.'));
        },
      });
  }
}
