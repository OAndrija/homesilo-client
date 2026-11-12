import {
  AfterViewInit,
  Component,
  computed,
  ElementRef,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { AdminUser } from '../../core/models/admin';
import { formatBytes } from '../../core/utils/format';

/** Deleting an account can't be undone, so the admin types the username to confirm. */
@Component({
  selector: 'app-delete-user-dialog',
  imports: [DecimalPipe],
  templateUrl: './delete-user-dialog.html',
  styleUrls: ['../../shared/dialog/dialog.css', './admin-dialog.css'],
})
export class DeleteUserDialog implements AfterViewInit {
  user = input.required<AdminUser>();
  busy = input(false);
  error = input('');

  confirm = output<void>();
  cancel = output<void>();

  field = viewChild<ElementRef<HTMLInputElement>>('field');
  typed = signal('');
  formatBytes = formatBytes;

  matches = computed(() => this.typed().trim() === this.user().username);

  ngAfterViewInit(): void {
    this.field()?.nativeElement.focus();
  }

  submit(): void {
    if (this.matches() && !this.busy()) this.confirm.emit();
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
