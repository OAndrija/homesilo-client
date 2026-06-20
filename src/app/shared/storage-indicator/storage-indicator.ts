import { Component, inject, signal, computed, input } from '@angular/core';
import { Files } from '../../core/services/files';

const MAX_STORAGE_BYTES = 10 * 1024 * 1024 * 1024;

@Component({
  selector: 'app-storage-indicator',
  imports: [],
  templateUrl: './storage-indicator.html',
  styleUrl: './storage-indicator.css',
  host: {
    '[class.open]': 'sidebarOpen()',
  },
})
export class StorageIndicator {
  private fileService = inject(Files);

  sidebarOpen = input.required<boolean>();

  usedBytes = signal(0);
  maxBytes = MAX_STORAGE_BYTES;

  percentUsed = computed(() => {
    const pct = (this.usedBytes() / this.maxBytes) * 100;
    return Math.min(pct, 100);
  });

  ngOnInit(): void {
    this.fileService.getStorageUsage().subscribe({
      next: (bytes) => this.usedBytes.set(bytes),
      error: () => {},
    });
  }

  formatGB(bytes: number): string {
    return (bytes / (1024 * 1024 * 1024)).toFixed(1);
  }
}
