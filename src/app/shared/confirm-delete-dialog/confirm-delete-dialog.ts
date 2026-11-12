import {
  AfterViewInit,
  Component,
  computed,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';

export interface DeleteTarget {
  type: 'file' | 'folder' | 'bulk' | 'emptyTrash';
  name?: string; // single file or folder name
  count?: number; // bulk or emptyTrash item count
}

@Component({
  selector: 'app-confirm-delete-dialog',
  templateUrl: './confirm-delete-dialog.html',
  styleUrl: '../dialog/dialog.css',
})
export class ConfirmDeleteDialog implements AfterViewInit {
  target = input.required<DeleteTarget>();

  confirm = output<void>();
  cancel = output<void>();

  private cancelButton = viewChild<ElementRef<HTMLButtonElement>>('cancelButton');

  /** Focus starts on Cancel, so an accidental Enter never deletes anything. */
  ngAfterViewInit(): void {
    this.cancelButton()?.nativeElement.focus();
  }

  title = computed(() => {
    switch (this.target().type) {
      case 'emptyTrash':
        return 'Empty trash?';
      case 'bulk':
        return `Delete ${this.target().count} items forever?`;
      default:
        return 'Delete forever?';
    }
  });

  message = computed(() => {
    const t = this.target();
    switch (t.type) {
      case 'file':
        return `“${t.name}” will be deleted permanently.`;
      case 'folder':
        return `“${t.name}” and everything in it will be deleted permanently.`;
      case 'bulk':
        return `${t.count} item${t.count !== 1 ? 's' : ''} will be deleted permanently.`;
      case 'emptyTrash':
        return `All ${t.count} item${t.count !== 1 ? 's' : ''} in the trash will be deleted permanently.`;
    }
  });

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as Element).classList.contains('dialog-backdrop')) {
      this.cancel.emit();
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') this.cancel.emit();
  }
}
