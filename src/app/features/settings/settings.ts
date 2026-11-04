import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { finalize } from 'rxjs';
import { errorMessage } from '../../core/http/http-error';
import { Auth } from '../../core/services/auth';
import { formatBytes } from '../../core/utils/format';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const next = group.get('newPassword')?.value;
  const confirm = group.get('confirmPassword')?.value;
  return next && confirm && next !== confirm ? { mismatch: true } : null;
}

@Component({
  selector: 'app-settings',
  imports: [ReactiveFormsModule, DatePipe],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
})
export class Settings {
  private auth = inject(Auth);

  user = this.auth.user;
  quota = computed(() => formatBytes(this.user()?.storageQuotaBytes ?? 0));

  form = new FormGroup(
    {
      currentPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
      newPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(8), Validators.maxLength(128)],
      }),
      confirmPassword: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
    },
    { validators: passwordsMatch },
  );

  submitted = signal(false);
  saving = signal(false);
  errorMessage = signal('');
  success = signal(false);

  onSubmit(): void {
    this.submitted.set(true);
    this.errorMessage.set('');
    this.success.set(false);
    if (this.form.invalid) return;

    const { currentPassword, newPassword } = this.form.getRawValue();
    this.saving.set(true);
    this.auth
      .changePassword({ currentPassword, newPassword })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => {
          this.success.set(true);
          this.submitted.set(false);
          this.form.reset();
        },
        error: (err) => this.errorMessage.set(errorMessage(err, 'Could not change your password.')),
      });
  }
}
