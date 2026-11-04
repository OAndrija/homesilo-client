import {
  AfterViewInit,
  Component,
  ElementRef,
  input,
  OnInit,
  output,
  signal,
  viewChild,
} from '@angular/core';

@Component({
  selector: 'app-folder-name-dialog',
  templateUrl: './folder-name-dialog.html',
  styleUrl: './folder-name-dialog.css',
})
export class FolderNameDialog implements OnInit, AfterViewInit {
  mode = input<'create' | 'rename'>('create');
  /** What is being named; only changes the wording. */
  itemType = input<'folder' | 'file'>('folder');
  initialName = input('');

  confirm = output<string>();
  cancel = output<void>();

  nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');
  value = signal('');

  ngOnInit(): void {
    // Seed before the first render so the selection below isn't reset by the value binding.
    this.value.set(this.initialName());
  }

  ngAfterViewInit(): void {
    const el = this.nameInput()?.nativeElement;
    if (el) {
      el.value = this.value();
      el.focus();
      // For files, pre-select only the base name so the extension survives typing.
      const dot = this.itemType() === 'file' ? this.initialName().lastIndexOf('.') : -1;
      if (dot > 0) el.setSelectionRange(0, dot);
      else el.select();
    }
  }

  get title(): string {
    return this.mode() === 'rename' ? `Rename ${this.itemType()}` : `New ${this.itemType()}`;
  }

  get placeholder(): string {
    return this.mode() === 'rename' ? 'Name' : `Untitled ${this.itemType()}`;
  }

  get confirmLabel(): string {
    return this.mode() === 'rename' ? 'Rename' : 'Create';
  }

  onConfirm(): void {
    const name = this.value().trim();
    if (!name || name === this.initialName()) {
      if (name) this.cancel.emit();
      return;
    }
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
