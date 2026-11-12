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

/**
 * A file's extension as the server sees it: the text after the last dot, or "" when
 * there is none (dot-files like ".env" count as having no extension).
 */
export function fileExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 && dot < name.length - 1 ? name.slice(dot + 1) : '';
}

/**
 * The full file name for an edited base name. Typing the extension out of habit
 * ("summary.pdf" in a box that already ends in .pdf) doesn't double it.
 */
export function withExtension(base: string, extension: string): string {
  const trimmed = base.trim();
  if (!extension) return trimmed;
  const suffix = `.${extension}`;
  return trimmed.toLowerCase().endsWith(suffix.toLowerCase()) ? trimmed : trimmed + suffix;
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
  extensionTag = viewChild<ElementRef<HTMLElement>>('extensionTag');
  /** What's in the text box: the whole name, or for a file rename just the part before the extension. */
  value = signal('');
  /** Room kept free on the right of the input for the extension tag. */
  suffixSpace = signal(0);

  /**
   * Renaming a file keeps its extension: the type was detected at upload, so
   * "report.pdf" → "report.i" would preview as a PDF but download as ".i". The server
   * refuses that too; here the extension is a fixed tag next to the name.
   */
  extension = computed(() =>
    this.mode() === 'rename' && this.itemType() === 'file' ? fileExtension(this.initialName()) : '',
  );
  fullName = computed(() => withExtension(this.value(), this.extension()));
  maxBaseLength = computed(() => 255 - (this.extension() ? this.extension().length + 1 : 0));

  problem = computed(() => nameProblem(this.fullName()));
  unchanged = computed(() => this.fullName() === this.initialName());
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
    const extension = this.extension();
    const name = this.initialName();
    this.value.set(extension ? name.slice(0, -(extension.length + 1)) : name);
  }

  ngAfterViewInit(): void {
    const el = this.nameInput()?.nativeElement;
    if (el) {
      el.value = this.value();
      el.focus();
      el.select();
    }
    const tag = this.extensionTag()?.nativeElement;
    if (tag) this.suffixSpace.set(tag.offsetWidth + 20);
  }

  onConfirm(): void {
    if (this.canSave()) this.confirm.emit(this.fullName());
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
