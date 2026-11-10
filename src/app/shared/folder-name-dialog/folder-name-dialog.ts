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

/** Client-side checks that mirror what the server rejects, so mistakes show while typing. */
export function nameProblem(name: string): string | null {
  const trimmed = name.trim();
  if (/[/\\]/.test(trimmed)) return 'Names can’t contain / or \\';
  if (trimmed === '.' || trimmed === '..') return 'That name is reserved';
  if (trimmed.length > 255) return 'Use 255 characters or fewer';
  return null;
}

@Component({
  selector: 'app-folder-name-dialog',
  templateUrl: './folder-name-dialog.html',
  styleUrl: '../dialog/dialog.css',
})
export class FolderNameDialog implements OnInit, AfterViewInit {
  mode = input<'create' | 'rename'>('create');
  /** What is being named; only changes the wording. */
  itemType = input<'folder' | 'file'>('folder');
  initialName = input('');
  /** True while the page is saving; the dialog stays open until it succeeds. */
  busy = input(false);
  /** The server's answer when saving failed (e.g. the name is taken). */
  error = input('');

  confirm = output<string>();
  cancel = output<void>();

  nameInput = viewChild<ElementRef<HTMLInputElement>>('nameInput');
  value = signal('');

  problem = computed(() => nameProblem(this.value()));
  unchanged = computed(() => this.value().trim() === this.initialName());
  canSave = computed(
    () => !!this.value().trim() && !this.problem() && !this.unchanged() && !this.busy(),
  );

  title = computed(() =>
    this.mode() === 'rename' ? `Rename ${this.itemType()}` : `New ${this.itemType()}`,
  );
  icon = computed(() => (this.mode() === 'rename' ? 'edit' : 'create_new_folder'));
  inputIcon = computed(() => (this.itemType() === 'file' ? 'description' : 'folder'));
  confirmLabel = computed(() => (this.mode() === 'rename' ? 'Rename' : 'Create folder'));

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

  onConfirm(): void {
    if (this.canSave()) this.confirm.emit(this.value().trim());
  }

  onBackdropClick(event: MouseEvent): void {
    if ((event.target as Element).classList.contains('dialog-backdrop') && !this.busy()) {
      this.cancel.emit();
    }
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') this.onConfirm();
    if (event.key === 'Escape' && !this.busy()) this.cancel.emit();
  }
}
