import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { API_BASE } from '../api';
import { DashboardStats } from '../models/dashboard-stats';

/**
 * Shared, lazily loaded dashboard stats (storage usage, counts). Root singleton:
 * {@link reset} must run on every login/logout so one account never sees
 * another's cached numbers.
 */
@Injectable({ providedIn: 'root' })
export class DashboardStore {
  private http = inject(HttpClient);

  private statsSignal = signal<DashboardStats | null>(null);
  private loadingSignal = signal(false);
  private loadedOnce = false;

  readonly stats = this.statsSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();

  /** Loads stats unless already loaded or loading. Safe to call from many components. */
  ensureLoaded(): void {
    if (this.loadedOnce || this.loadingSignal()) return;
    this.fetch(true);
  }

  /** Refetch after anything that changes usage (upload, trash, restore, delete). */
  refresh(): void {
    this.fetch(true);
  }

  /** Refetch without flipping the loading flag, so nothing flickers. */
  silentRefresh(): void {
    this.fetch(false);
  }

  reset(): void {
    this.statsSignal.set(null);
    this.loadingSignal.set(false);
    this.loadedOnce = false;
  }

  private fetch(showLoading: boolean): void {
    if (showLoading) this.loadingSignal.set(true);
    this.http.get<DashboardStats>(`${API_BASE}/dashboard/stats`).subscribe({
      next: (stats) => {
        this.statsSignal.set(stats);
        this.loadedOnce = true;
        this.loadingSignal.set(false);
      },
      error: () => this.loadingSignal.set(false),
    });
  }
}
