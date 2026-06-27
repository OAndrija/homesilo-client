import { Component, input, output, computed } from '@angular/core';

export interface DeleteTarget {
  type: 'file' | 'folder' | 'bulk' | 'emptyTrash';
  name?: string; // single file or folder name
  count?: number; // bulk or emptyTrash item count
}

@Component({
  selector: 'app-confirm-delete-dialog',
  templateUrl: './confirm-delete-dialog.html',
  styleUrl: './confirm-delete-dialog.css',
})
export class ConfirmDeleteDialog {
  target = input.required<DeleteTarget>();

  confirm = output<void>();
  cancel = output<void>();

  title = computed(() => {
    switch (this.target().type) {
      case 'emptyTrash':
        return 'Empty trash';
      case 'bulk':
        return `Delete ${this.target().count} items`;
      default:
        return 'Delete forever';
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
