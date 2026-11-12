import { AfterViewInit, Component, ElementRef, input, output, viewChild } from '@angular/core';

/**
 * Asks before doing something with consequences. Focus starts on Cancel, so an
 * accidental Enter never confirms; Escape or a click outside cancels.
 */
@Component({
  selector: 'app-confirm-dialog',
  templateUrl: './confirm-dialog.html',
  styleUrl: '../dialog/dialog.css',
})
export class ConfirmDialog implements AfterViewInit {
  title = input.required<string>();
  message = input.required<string>();
  /** A short line under the title, such as "You can undo this". */
  note = input<string>('');
  confirmLabel = input.required<string>();
  icon = input('help');
  /** `danger` for things that can't be taken back. */
  tone = input<'default' | 'danger'>('default');

  confirm = output<void>();
  cancel = output<void>();

  private cancelButton = viewChild<ElementRef<HTMLButtonElement>>('cancelButton');

  ngAfterViewInit(): void {
    this.cancelButton()?.nativeElement.focus();
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as Element).classList.contains('dialog-backdrop')) this.cancel.emit();
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    // The page behind may use Escape too (leaving edit mode); this Escape is ours.
    event.stopPropagation();
    this.cancel.emit();
  }
}
