import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { errorMessage } from '../../../core/http/http-error';
import { Auth } from '../../../core/services/auth';

/** Mirrors the server-side rules in RegisterRequest. */
const USERNAME_PATTERN = /^[A-Za-z0-9._-]+$/;

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.css',
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
