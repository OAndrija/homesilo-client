import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit } from '@angular/core';
import { DashboardStore } from '../../core/services/dashboard-store';
import { formatBytes } from '../../core/utils/format';

@Component({
  selector: 'app-storage-indicator',
  imports: [DecimalPipe],
  templateUrl: './storage-indicator.html',
  styleUrl: './storage-indicator.css',
})
export class StorageIndicator implements OnInit {
  private store = inject(DashboardStore);

  private used = computed(() => this.store.stats()?.storageUsedBytes ?? 0);
  private quota = computed(() => this.store.stats()?.storageQuotaBytes ?? 0);

  loaded = computed(() => this.store.stats() !== null);
  percent = computed(() =>
    this.quota() > 0 ? Math.min((this.used() / this.quota()) * 100, 100) : 0,
  );
  level = computed(() =>
    this.percent() >= 90 ? 'critical' : this.percent() >= 75 ? 'warn' : 'ok',
  );
  label = computed(() => `${formatBytes(this.used())} of ${formatBytes(this.quota())}`);

  ngOnInit(): void {
    this.store.ensureLoaded();
  }
}
