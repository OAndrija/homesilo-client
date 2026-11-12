import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { API_BASE } from '../api';
import {
  DashboardLayoutResponse,
  DEFAULT_LAYOUT,
  normalizeLayout,
  PlacedTile,
  sameLayout,
} from '../models/dashboard-layout';
import { Auth } from './auth';

const URL = `${API_BASE}/dashboard/layout`;

/**
 * Which tiles the dashboard shows. The layout is kept with the account on the
 * server; a copy in this browser lets the dashboard draw the right tiles at once
 * instead of flashing the default while the server answers.
 */
@Injectable({ providedIn: 'root' })
export class DashboardLayoutService {
  private http = inject(HttpClient);
  private auth = inject(Auth);

  private readonly tilesSignal = signal<PlacedTile[] | null>(null);
  /** Null until known: from this browser's copy first, then from the server. */
  readonly tiles = this.tilesSignal.asReadonly();

  load(): void {
    // Reset first, so a different account never sees the previous one's tiles.
    this.tilesSignal.set(this.readCache());
    this.http.get<DashboardLayoutResponse>(URL).subscribe({
      next: (response) => this.apply(response),
      // Without the server, keep whatever we have, or fall back to the default.
      error: () => this.tilesSignal.update((t) => t ?? [...DEFAULT_LAYOUT]),
    });
  }

  /** Saves a layout; one equal to the default is stored as "not customized". */
  save(tiles: PlacedTile[]): Observable<unknown> {
    if (sameLayout(tiles, DEFAULT_LAYOUT)) {
      return this.http.delete(URL).pipe(tap(() => this.set([...DEFAULT_LAYOUT])));
    }
    return this.http
      .put<DashboardLayoutResponse>(URL, { tiles })
      .pipe(tap((response) => this.apply(response)));
  }

  private apply(response: DashboardLayoutResponse): void {
    this.set(response.customized ? normalizeLayout(response.tiles) : [...DEFAULT_LAYOUT]);
  }

  private set(tiles: PlacedTile[]): void {
    this.tilesSignal.set(tiles);
    this.writeCache(tiles);
  }

  private cacheKey(): string | null {
    const id = this.auth.user()?.id;
    return id ? `hs-dashboard-${id}` : null;
  }

  private readCache(): PlacedTile[] | null {
    const key = this.cacheKey();
    if (!key) return null;
    try {
      const raw = localStorage.getItem(key);
      return raw ? normalizeLayout(JSON.parse(raw)) : null;
    } catch {
      return null;
    }
  }

  private writeCache(tiles: PlacedTile[]): void {
    const key = this.cacheKey();
    if (!key) return;
    try {
      localStorage.setItem(key, JSON.stringify(tiles));
    } catch {
      // Private mode or full storage: the server copy is enough.
    }
  }
}
