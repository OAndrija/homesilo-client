import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Auth } from '../../../core/services/auth';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private auth = inject(Auth);
  private router = inject(Router);

  form = new FormGroup({
    username: new FormControl('', [Validators.required]),
    password: new FormControl('', [Validators.required]),
  });

  submitted = false;

  errorMessage = signal('');
  loading = signal(false);

  get username() {
    return this.form.controls.username;
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
      .login({
        username: this.username.value!,
        password: this.password.value!,
      })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => this.router.navigate(['/home']),
        error: (err) => {
          this.errorMessage.set(err.error?.error ?? 'Invalid username or password.');
        },
      });
  }
}
