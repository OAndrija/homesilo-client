import {
  AfterViewInit,
  Component,
  computed,
  ElementRef,
  input,
  OnInit,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { AdminUser, NewUser, UserChanges } from '../../core/models/admin';
import { UserRole } from '../../core/models/auth.models';
import { formatBytes } from '../../core/utils/format';
import {
  generatePassword,
  SIZE_UNITS,
  SizeUnit,
  splitBytes,
  toBytes,
} from '../../core/utils/storage-size';

const USERNAME = /^[A-Za-z0-9._-]{3,64}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Adds an account, or edits an existing one's role and storage limit. */
@Component({
  selector: 'app-user-form-dialog',
  templateUrl: './user-form-dialog.html',
  styleUrls: ['../../shared/dialog/dialog.css', './admin-dialog.css'],
})
export class UserFormDialog implements OnInit, AfterViewInit {
  mode = input.required<'add' | 'edit'>();
  user = input<AdminUser | null>(null);
  /** Editing your own account: the role can't be changed. */
  isSelf = input(false);
  defaultQuotaBytes = input(0);
  busy = input(false);
  error = input('');

  create = output<NewUser>();
  save = output<{ id: string; changes: UserChanges }>();
  cancel = output<void>();

  usernameField = viewChild<ElementRef<HTMLInputElement>>('usernameField');
  quotaField = viewChild<ElementRef<HTMLInputElement>>('quotaField');

  readonly units = SIZE_UNITS;
  formatBytes = formatBytes;

  username = signal('');
  email = signal('');
  password = signal('');
  showPassword = signal(true);
  copied = signal(false);
  role = signal<UserRole>('USER');
  quotaValue = signal(0);
  quotaUnit = signal<SizeUnit>('GB');
  submitted = signal(false);

  quotaBytes = computed(() => toBytes(this.quotaValue(), this.quotaUnit()));

  usernameError = computed(() => {
    const value = this.username().trim();
    if (!value) return 'Enter a username';
    if (!USERNAME.test(value)) return 'Use 3–64 letters, numbers, dots, dashes or underscores';
    return '';
  });
  emailError = computed(() =>
    EMAIL.test(this.email().trim()) ? '' : 'Enter a valid email address',
  );
  passwordError = computed(() => (this.password().length >= 8 ? '' : 'Use at least 8 characters'));
  quotaError = computed(() =>
    Number.isFinite(this.quotaValue()) && this.quotaValue() >= 0 ? '' : 'Enter a size of 0 or more',
  );

  /** Lowering the limit below what they already store blocks their uploads. */
  quotaBelowUsage = computed(() => {
    const user = this.user();
    return !!user && this.quotaBytes() < user.storageUsedBytes;
  });

  changes = computed<UserChanges>(() => {
    const user = this.user();
    if (!user) return {};
    const changes: UserChanges = {};
    if (this.role() !== user.role) changes.role = this.role();
    if (this.quotaBytes() !== user.storageQuotaBytes) changes.storageQuotaBytes = this.quotaBytes();
    return changes;
  });

  canSubmit = computed(() => {
    if (this.busy() || this.quotaError()) return false;
    if (this.mode() === 'edit') return Object.keys(this.changes()).length > 0;
    return true; // add: field errors show after the first attempt
  });

  ngOnInit(): void {
    const user = this.user();
    const quota = user ? user.storageQuotaBytes : this.defaultQuotaBytes();
    const { value, unit } = splitBytes(quota);
    this.quotaValue.set(value);
    this.quotaUnit.set(unit);
    if (user) {
      this.role.set(user.role);
    } else {
      this.password.set(generatePassword());
    }
  }

  ngAfterViewInit(): void {
    (this.usernameField() ?? this.quotaField())?.nativeElement.focus();
  }

  regenerate(): void {
    this.password.set(generatePassword());
    this.showPassword.set(true);
    this.copied.set(false);
  }

  async copyPassword(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.password());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      this.showPassword.set(true); // can't copy: at least make it readable
    }
  }

  setQuotaValue(raw: string): void {
    this.quotaValue.set(raw === '' ? NaN : Number(raw));
  }

  setQuotaUnit(raw: string): void {
    if ((SIZE_UNITS as readonly string[]).includes(raw)) this.quotaUnit.set(raw as SizeUnit);
  }

  submit(): void {
    this.submitted.set(true);
    if (!this.canSubmit()) return;
    const user = this.user();
    if (this.mode() === 'edit' && user) {
      this.save.emit({ id: user.id, changes: this.changes() });
      return;
    }
    if (this.usernameError() || this.emailError() || this.passwordError()) return;
    this.create.emit({
      username: this.username().trim(),
      email: this.email().trim(),
      password: this.password(),
      role: this.role(),
      storageQuotaBytes: this.quotaBytes(),
    });
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as Element).classList.contains('dialog-backdrop') && !this.busy()) {
      this.cancel.emit();
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && !this.busy()) this.cancel.emit();
  }
}
