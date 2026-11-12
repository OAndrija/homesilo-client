import { Component, computed, inject } from '@angular/core';
import { UploadItem, UploadService } from '../../core/services/uploads';
import { getFileIcon } from '../../core/utils/file-icon.util';
import { formatBytes } from '../../core/utils/format';

/** Bottom-right card listing each upload with its own progress, like Drive's. */
@Component({
  selector: 'app-upload-panel',
  templateUrl: './upload-panel.html',
  styleUrl: './upload-panel.css',
})
export class UploadPanel {
  protected uploads = inject(UploadService);
  collapsed = this.uploads.collapsed;

  readonly getFileIcon = getFileIcon;

  title = computed(() => {
    const remaining = this.uploads.remainingCount();
    const done = this.uploads.doneCount();
    const failed = this.uploads.failedCount();
    if (remaining > 0) return `Uploading ${remaining} file${remaining === 1 ? '' : 's'}`;
    if (failed > 0) return `${failed} upload${failed === 1 ? '' : 's'} failed`;
    return `${done} upload${done === 1 ? '' : 's'} complete`;
  });

  /** Overall progress across the batch, weighted by size. */
  overall = computed(() => {
    const items = this.uploads.items().filter((i) => i.status !== 'cancelled');
    const total = items.reduce((sum, i) => sum + i.size, 0);
    if (total === 0) return 0;
    const done = items.reduce(
      (sum, i) =>
        sum + (i.status === 'done' || i.status === 'error' ? i.size : (i.size * i.progress) / 100),
      0,
    );
    return Math.round((done / total) * 100);
  });

  detail(item: UploadItem): string {
    switch (item.status) {
      case 'queued':
        return `Waiting · ${formatBytes(item.size)}`;
      case 'uploading':
        return `${item.progress}% of ${formatBytes(item.size)}`;
      case 'done':
        return formatBytes(item.size);
      case 'cancelled':
        return 'Cancelled';
      case 'error':
        return item.error ?? 'Upload failed';
    }
  }
}
