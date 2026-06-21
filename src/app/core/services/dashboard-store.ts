import { inject, Injectable, signal } from '@angular/core';
import { Dashboard } from './dashboard';
import { DashboardStats } from '../models/dashboard-stats';

@Injectable({ providedIn: 'root' })
export class DashboardStore {
  private dashboardService = inject(Dashboard);

  private statsSignal = signal<DashboardStats | null>(null);
  private loadingSignal = signal(false);
  private loadedOnce = false;

  readonly stats = this.statsSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();

  /** Loads stats only if not already loaded/loading. Safe to call from multiple components. */
  ensureLoaded(): void {
    if (this.loadedOnce || this.loadingSignal()) return;
    this.fetch();
  }

  /** Forces a refetch — call after upload/trash/restore/delete actions. */
  refresh(): void {
    this.fetch();
  }

  /**
   * Clears cached stats and the loadedOnce flag. Must be called on logout
   * (and ideally on login) — this store is a root singleton, so without an
   * explicit reset it keeps serving the previous user's cached data after
   * an account switch.
   */
  reset(): void {
    this.statsSignal.set(null);
    this.loadingSignal.set(false);
    this.loadedOnce = false;
  }

  private fetch(): void {
    this.loadingSignal.set(true);
    this.dashboardService.getStats().subscribe({
      next: (stats) => {
        this.statsSignal.set(stats);
        this.loadedOnce = true;
        this.loadingSignal.set(false);
      },
      error: () => {
        this.loadingSignal.set(false);
      },
    });
  }
}
