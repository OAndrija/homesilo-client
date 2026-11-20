import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Location } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { errorMessage } from '../../../core/http/http-error';
import { Auth } from '../../../core/services/auth';
import { InvitePreview } from '../../../core/models/invite';
import { AuthShell } from '../auth-shell/auth-shell';

/** Mirrors the server-side rules in RegisterRequest. */
const USERNAME_PATTERN = /^[A-Za-z0-9._-]+$/;

const STRENGTH_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];

const INCOMPLETE_LINK =
  "This invite link isn't complete. Copy the whole link from the message you were sent.";

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

/** Where an invite link stands, on the /invite page. */
type InviteState =
  | { kind: 'none' }
  | { kind: 'checking' }
  | { kind: 'valid'; preview: InvitePreview }
  | { kind: 'invalid'; message: string };

/**
 * Creating an account: open to anyone when sign-up is enabled, or with an
 * admin's invite link (/invite#secret) when it's invite-only.
 */
@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, AuthShell],
  templateUrl: './register.html',
  styleUrl: '../auth-form.css',
})
export class Register {
  private auth = inject(Auth);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private location = inject(Location);

  /** The invite link's secret, kept here once read from the address. */
  private inviteToken: string | null = null;
  invite = signal<InviteState>({ kind: 'none' });

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
  /** Whether the form can be sent: sign-up is open, or there's a working invite. */
  canSignUp = computed(() => {
    const invite = this.invite();
    if (invite.kind === 'valid') return true;
    if (invite.kind !== 'none') return false;
    return this.registrationOpen();
  });

  constructor() {
    if (this.route.snapshot.data['invite']) this.readInvite();
    this.auth.config().subscribe({
      next: (config) => this.registrationOpen.set(config.registrationEnabled),
    });
  }

  /**
   * Takes the secret from after the # and clears it from the address bar and
   * history, so it isn't left behind on a shared computer.
   */
  private readInvite(): void {
    const token = this.route.snapshot.fragment?.trim() ?? '';
    this.location.replaceState('/invite');
    if (!token) {
      this.invite.set({ kind: 'invalid', message: INCOMPLETE_LINK });
      return;
    }
    this.inviteToken = token;
    this.invite.set({ kind: 'checking' });
    this.auth.previewInvite(token).subscribe({
      next: (preview) => this.invite.set({ kind: 'valid', preview }),
      error: (err) =>
        this.invite.set({
          kind: 'invalid',
          message: errorMessage(
            err,
            "This invite link couldn't be checked. Try again in a moment.",
          ),
        }),
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
      .register({ ...this.form.getRawValue(), inviteToken: this.inviteToken ?? undefined })
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: () => this.router.navigate(['/home']),
        error: (err) =>
          this.errorMessage.set(errorMessage(err, 'Registration failed. Please try again.')),
      });
  }
}
