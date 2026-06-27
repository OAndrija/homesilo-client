import {
  Component,
  input,
  output,
  signal,
  ElementRef,
  viewChild,
  AfterViewInit,
} from '@angular/core';

@Component({
  selector: 'app-folder-name-dialog',
  templateUrl: './folder-name-dialog.html',
  styleUrl: './folder-name-dialog.css',
})
export class FolderNameDialog implements AfterViewInit {
  mode = input<'create' | 'rename'>('create');
  initialName = input('');

  confirm = output<string>();
  cancel = output<void>();

  nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');
  value = signal('');

  ngAfterViewInit(): void {
    // Seed value from input and focus
    this.value.set(this.initialName());
    const el = this.nameInput()?.nativeElement;
    if (el) {
      el.focus();
      el.select();
    }
  }

  get title(): string {
    return this.mode() === 'rename' ? 'Rename folder' : 'New folder';
  }

  get placeholder(): string {
    return this.mode() === 'rename' ? 'Folder name' : 'Untitled folder';
  }

  get confirmLabel(): string {
    return this.mode() === 'rename' ? 'Rename' : 'Create';
  }

  onConfirm(): void {
    const name = this.value().trim();
    if (!name) return;
    this.confirm.emit(name);
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as Element).classList.contains('dialog-backdrop')) {
      this.cancel.emit();
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') this.onConfirm();
    if (event.key === 'Escape') this.cancel.emit();
  }
}
