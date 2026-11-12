import { HttpClient } from '@angular/common/http';
import {
  Component,
  computed,
  effect,
  ElementRef,
  HostListener,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FileActions } from '../../core/services/file-actions';
import { FilePreviewService, previewKind } from '../../core/services/file-preview';
import { Files } from '../../core/services/files';
import { getFileIcon } from '../../core/utils/file-icon.util';
import { formatBytes } from '../../core/utils/format';
import { FriendlyDatePipe } from '../pipes/friendly-date';

/** Text bigger than this is offered as a download rather than loaded into the page. */
const MAX_TEXT_BYTES = 2 * 1024 * 1024;
/** Characters of a text file shown before cutting off. */
const MAX_TEXT_CHARS = 200_000;

/** Full-screen viewer for images, video, audio, PDFs and text, opened from any file list. */
@Component({
  selector: 'app-file-preview',
  imports: [FriendlyDatePipe],
  templateUrl: './file-preview.html',
  styleUrl: './file-preview.css',
})
export class FilePreview {
  protected preview = inject(FilePreviewService);
  private files = inject(Files);
  private fileActions = inject(FileActions);
  private http = inject(HttpClient);
  private sanitizer = inject(DomSanitizer);

  private closeButton = viewChild<ElementRef<HTMLButtonElement>>('closeButton');
  private returnFocusTo: HTMLElement | null = null;

  file = this.preview.current;
  kind = computed(() => previewKind(this.file()?.contentType));
  url = computed(() => {
    const file = this.file();
    return file ? this.files.previewUrl(file.id) : '';
  });
  thumbUrl = computed(() => {
    const file = this.file();
    return file?.thumbnail ? this.files.thumbnailUrl(file.id) : '';
  });
  /** PDFs go in an iframe; the URL is our own API, built from the file id. */
  frameUrl = computed<SafeResourceUrl | null>(() =>
    this.kind() === 'pdf' ? this.sanitizer.bypassSecurityTrustResourceUrl(this.url()) : null,
  );
  icon = computed(() => getFileIcon(this.file()?.originalFileName ?? ''));
  readonly formatBytes = formatBytes;

  mediaLoading = signal(true);
  mediaFailed = signal(false);
  text = signal<string | null>(null);
  textTruncated = signal(false);
  textTooLarge = computed(() => (this.file()?.size ?? 0) > MAX_TEXT_BYTES);

  constructor() {
    // Reset per file, and fetch text content when needed.
    effect((onCleanup) => {
      const file = this.file();
      const kind = this.kind();
      untracked(() => {
        this.mediaLoading.set(true);
        this.mediaFailed.set(false);
        this.text.set(null);
        this.textTruncated.set(false);
      });
      if (!file || kind !== 'text' || file.size > MAX_TEXT_BYTES) return;

      const sub = this.http
        .get(this.files.previewUrl(file.id), { responseType: 'text' })
        .subscribe({
          next: (body) => {
            this.textTruncated.set(body.length > MAX_TEXT_CHARS);
            this.text.set(body.slice(0, MAX_TEXT_CHARS));
            this.mediaLoading.set(false);
          },
          error: () => {
            this.mediaFailed.set(true);
            this.mediaLoading.set(false);
          },
        });
      onCleanup(() => sub.unsubscribe());
    });

    // Move focus into the viewer when it opens, and back to where it was when it closes.
    effect(() => {
      const open = this.preview.isOpen();
      untracked(() => {
        if (open) {
          this.returnFocusTo ??= document.activeElement as HTMLElement | null;
          setTimeout(() => this.closeButton()?.nativeElement.focus());
        } else if (this.returnFocusTo) {
          this.returnFocusTo.focus?.();
          this.returnFocusTo = null;
        }
      });
    });
  }

  close(): void {
    this.preview.close();
  }

  download(): void {
    const file = this.file();
    if (file) this.fileActions.download(file);
  }

  /** Clicking the dark area around the content closes the viewer. */
  onStageClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.close();
  }

  @HostListener('document:keydown', ['$event'])
  onKeydown(event: KeyboardEvent): void {
    if (!this.preview.isOpen()) return;
    const target = event.target as HTMLElement;
    const inMediaControls = target.tagName === 'VIDEO' || target.tagName === 'AUDIO';
    switch (event.key) {
      case 'Escape':
        event.preventDefault();
        this.close();
        break;
      case 'ArrowRight':
        if (inMediaControls) return;
        event.preventDefault();
        this.preview.next();
        break;
      case 'ArrowLeft':
        if (inMediaControls) return;
        event.preventDefault();
        this.preview.previous();
        break;
    }
  }
}
