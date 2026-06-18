import { Component, inject } from '@angular/core';
import { form } from '@angular/forms/signals';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../../core/services/auth';

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
    username: new FormControl('', [
      Validators.required,
      Validators.maxLength(255),
    ]),
    email: new FormControl('', [
      Validators.required,
      Validators.email
    ]),
    password: new FormControl('', [
      Validators.required,
      Validators.minLength(6),
      Validators.maxLength(255)
    ])
  });

  submitted = false;
  errorMessage = '';
  loading = false;

  get username() { return this.form.controls.username }
  get email() { return this.form.controls.email }
  get password() { return this.form.controls.password }

  onSubmit(): void {
    this.submitted = true;
    this.errorMessage = '';

    if (this.form.invalid) return;

    this.loading = true;

    this.auth.register({
      username: this.username.value!,
      email: this.email.value!,
      password: this.password.value!
    }).subscribe({
      next: () => {
        this.router.navigate(['/home']);
      },
      error: (err) => {
        this.errorMessage = err.error?.error ?? 'Registration failed. Please try again.';
        this.loading = false;
      }
    });
  }
}
