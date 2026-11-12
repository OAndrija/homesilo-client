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
import { AdminUser } from '../../core/models/admin';
import { generatePassword } from '../../core/utils/storage-size';

/** Sets a new password for someone who is locked out; their sessions end. */
@Component({
  selector: 'app-password-dialog',
  templateUrl: './password-dialog.html',
  styleUrls: ['../../shared/dialog/dialog.css', './admin-dialog.css'],
})
export class PasswordDialog implements OnInit, AfterViewInit {
  user = input.required<AdminUser>();
  busy = input(false);
  error = input('');

  confirm = output<string>();
  cancel = output<void>();

  field = viewChild<ElementRef<HTMLInputElement>>('field');

  password = signal('');
  showPassword = signal(true);
  copied = signal(false);
  tooShort = computed(() => this.password().length < 8);

  ngOnInit(): void {
    this.password.set(generatePassword());
  }

  ngAfterViewInit(): void {
    const el = this.field()?.nativeElement;
    el?.focus();
    el?.select();
  }

  regenerate(): void {
    this.password.set(generatePassword());
    this.showPassword.set(true);
    this.copied.set(false);
  }

  async copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.password());
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    } catch {
      this.showPassword.set(true);
    }
  }

  submit(): void {
    if (!this.tooShort() && !this.busy()) this.confirm.emit(this.password());
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
