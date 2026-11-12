import { Component, inject, computed, input } from '@angular/core';
import { DashboardStore } from '../../core/services/dashboard-store';

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
  private store = inject(DashboardStore);
  sidebarOpen = input.required<boolean>();

  usedBytes = computed(() => this.store.stats()?.storageUsedBytes ?? 0);
  maxBytes = computed(() => this.store.stats()?.storageQuotaBytes ?? 1);

  percentUsed = computed(() => {
    const pct = (this.usedBytes() / this.maxBytes()) * 100;
    return Math.min(pct, 100);
  });

  ngOnInit(): void {
    this.store.ensureLoaded();
  }

  /** One decimal, without a trailing ".0" (1.5, 100), matching the dashboard. */
  formatGB(bytes: number): string {
    return String(Number((bytes / (1024 * 1024 * 1024)).toFixed(1)));
  }
}
