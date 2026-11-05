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
})
export class ConfirmDeleteDialog implements AfterViewInit {
  private cancelButton = viewChild<ElementRef<HTMLButtonElement>>('cancelButton');

  /** Focus the safe choice, so Enter never deletes by accident. */
  ngAfterViewInit(): void {
    this.cancelButton()?.nativeElement.focus();
  }

  target = input.required<DeleteTarget>();

  confirm = output<void>();
  cancel = output<void>();

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
        return `"${t.name}" will be permanently deleted and cannot be recovered.`;
      case 'folder':
        return `"${t.name}" and all its contents will be permanently deleted and cannot be recovered.`;
      case 'bulk':
        return `${t.count} item${t.count !== 1 ? 's' : ''} will be permanently deleted and cannot be recovered.`;
      case 'emptyTrash':
        return `All ${t.count} item${t.count !== 1 ? 's' : ''} in trash will be permanently deleted and cannot be recovered.`;
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
