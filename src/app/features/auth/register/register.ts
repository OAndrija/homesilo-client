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
    username: new FormControl('', Validators.required),
    email: new FormControl('', Validators.required),
    password: new FormControl('', Validators.required)
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
        this.errorMessage = err.message;
        this.loading = false;
      }
    });
  }
}
