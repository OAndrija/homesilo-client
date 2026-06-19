import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../../core/services/auth';
import { finalize } from 'rxjs';

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
    username: new FormControl('', [Validators.required, Validators.maxLength(255)]),
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [
      Validators.required,
      Validators.minLength(6),
      Validators.maxLength(255),
    ]),
  });

  submitted = false;
  errorMessage = signal('');
  loading = signal(false);

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
      .register({
        username: this.username.value!,
        email: this.email.value!,
        password: this.password.value!,
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => this.router.navigate(['/my-files']),
        error: (err) => {
          this.errorMessage.set(err.error?.error ?? 'Registration failed. Please try again.');
        },
      });
  }
}
