import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { catchError, concatMap, Observable, of, Subject, map, timeout } from 'rxjs';
import { API_BASE } from '../api';

const URL = `${API_BASE}/users/me/preferences`;
/** Set once this browser's old, shared settings have been given to an account. */
const CLAIMED_KEY = 'hs-prefs-claimed';
/** How long sign-in waits for the settings before showing the app anyway. */
const LOAD_TIMEOUT_MS = 3000;

export type PreferenceValues = Readonly<Record<string, string>>;

interface PreferencesResponse {
  values: Record<string, string>;
  updatedAt: string | null;
}

/**
 * The signed-in person's settings (appearance, and how each list is viewed and
 * sorted), kept with their account on the server so they follow it to every
 * device and stay apart from anyone else using this browser.
 *
 * A copy per account in this browser lets the app start with the right look
 * instead of flashing the defaults while the server answers. A setting that
 * isn't here has its default; setting one to null puts it back.
 */
@Injectable({ providedIn: 'root' })
export class PreferencesService {
  private http = inject(HttpClient);

  private readonly valuesSignal = signal<PreferenceValues>({});
  readonly values = this.valuesSignal.asReadonly();
  /**
   * Goes up each time another account's settings, or a fresh copy from the
   * server, replace what's here. Changes made in this tab don't count, since
   * whatever made them already shows them.
   */
  readonly revision = signal(0);

  private userId: string | null = null;
  private readonly outbox = new Subject<{
    userId: string;
    values: Record<string, string | null>;
  }>();

  constructor() {
    // One change at a time, in order, so a later choice is never overwritten by an earlier one.
    this.outbox
      .pipe(
        concatMap(({ userId, values }) =>
          // Dropped if someone else signed in before it was sent.
          userId !== this.userId
            ? of(null)
            : this.http
                .patch<PreferencesResponse>(URL, { values })
                .pipe(catchError(() => of(null))),
        ),
      )
      .subscribe();
  }

  /**
   * Switches to an account's settings: this browser's copy at once, then the
   * server's. Completes when the server has answered (or after a few seconds
   * without it), so sign-in can wait for the right look before showing the app.
   */
  load(userId: string): Observable<void> {
    this.userId = userId;
    // Read before anything is shown, since showing a look also records it in the browser.
    const deviceSettings = this.deviceSettingsToClaim();
    const cached = this.readCache(userId);
    if (cached) {
      this.replace(cached);
    } else {
      // Nothing to show yet: keep the look on screen until the server answers.
      this.valuesSignal.set({});
    }
    return this.http.get<PreferencesResponse>(URL).pipe(
      timeout(LOAD_TIMEOUT_MS),
      map((response) => {
        if (this.userId !== userId) return;
        // The first account to sign in here takes this browser's old settings
        // either way, and uses them only if it has nothing saved.
        if (deviceSettings) this.markDeviceSettingsClaimed();
        const empty = Object.keys(response.values).length === 0;
        if (empty && deviceSettings && Object.keys(deviceSettings).length) {
          this.replace(deviceSettings);
          this.send(deviceSettings);
        } else {
          this.replace(response.values);
        }
      }),
      catchError(() => {
        // Offline or slow: carry on with this browser's copy, or the defaults
        // rather than whoever was here before.
        if (this.userId === userId && !cached) this.replace({});
        return of(undefined);
      }),
    );
  }

  /** Signed out: forget whose settings these were. What shows stays as it is. */
  clear(): void {
    this.userId = null;
    this.valuesSignal.set({});
  }

  get(key: string): string | null {
    return this.valuesSignal()[key] ?? null;
  }

  /** Changes settings; a null value goes back to the default. */
  set(changes: Record<string, string | null>): void {
    const current = this.valuesSignal();
    const changed = Object.entries(changes).filter(
      ([key, value]) => (current[key] ?? null) !== value,
    );
    if (!this.userId || changed.length === 0) return;

    const next: Record<string, string> = { ...current };
    for (const [key, value] of changed) {
      if (value === null) delete next[key];
      else next[key] = value;
    }
    this.valuesSignal.set(next);
    this.writeCache(this.userId, next);
    this.send(Object.fromEntries(changed));
  }

  private replace(values: Record<string, string>): void {
    this.valuesSignal.set({ ...values });
    if (this.userId) this.writeCache(this.userId, values);
    this.revision.update((r) => r + 1);
  }

  private send(values: Record<string, string | null>): void {
    if (this.userId) this.outbox.next({ userId: this.userId, values });
  }

  /**
   * Settings used to be kept in the browser for whoever signed in. The first
   * account to sign in here after that changed takes them over (if it has
   * nothing saved yet), so nobody loses the look they had picked. Later
   * accounts start from the defaults.
   */
  private deviceSettingsToClaim(): Record<string, string> | null {
    try {
      if (localStorage.getItem(CLAIMED_KEY)) return null;
      return legacyDeviceSettings();
    } catch {
      return null;
    }
  }

  private markDeviceSettingsClaimed(): void {
    try {
      localStorage.setItem(CLAIMED_KEY, '1');
      for (const key of Array.from({ length: localStorage.length }, (_, i) =>
        localStorage.key(i),
      )) {
        // Lists now read these from the account; the browser-wide copies only get in the way.
        if (key && /^hs-(view|sort)-/.test(key)) localStorage.removeItem(key);
      }
    } catch {
      // Storage unavailable: nothing was there to claim.
    }
  }

  private readCache(userId: string): Record<string, string> | null {
    try {
      const raw = localStorage.getItem(`hs-prefs-${userId}`);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      if (!parsed || typeof parsed !== 'object') return null;
      return Object.fromEntries(
        Object.entries(parsed).filter(([, v]) => typeof v === 'string'),
      ) as Record<string, string>;
    } catch {
      return null;
    }
  }

  private writeCache(userId: string, values: Record<string, string>): void {
    try {
      localStorage.setItem(`hs-prefs-${userId}`, JSON.stringify(values));
    } catch {
      // Private mode or full storage: the server copy is enough.
    }
  }
}

/** Old browser-wide settings, as preference values, leaving out the defaults. */
function legacyDeviceSettings(): Record<string, string> {
  const values: Record<string, string> = {};
  const copy = (from: string, to: string, unless: string) => {
    const value = localStorage.getItem(from);
    if (value && value !== unless) values[to] = value;
  };
  copy('hs-theme', 'theme.mode', 'system');
  copy('hs-theme-light', 'theme.light', 'homesilo-light');
  copy('hs-theme-dark', 'theme.dark', 'homesilo-dark');
  copy('hs-accent', 'appearance.accent', 'theme');
  copy('hs-corners', 'appearance.corners', 'rounded');
  copy('hs-spacing', 'appearance.spacing', 'comfortable');
  copy('hs-cards', 'appearance.cards', 'vivid');
  copy('hs-font', 'appearance.font', 'inter');
  copy('hs-motion', 'appearance.motion', 'system');

  const keys = Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i));
  for (const key of keys) {
    if (!key) continue;
    const view = /^hs-view-([a-z][a-z0-9-]{0,29})$/.exec(key);
    if (view) copy(key, `view.${view[1]}`, 'list');
    const sort = /^hs-sort-([a-z][a-z0-9-]{0,29})$/.exec(key);
    if (sort) {
      try {
        const s = JSON.parse(localStorage.getItem(key) ?? 'null');
        if (
          s &&
          /^[a-zA-Z]{1,30}$/.test(s.key) &&
          (s.direction === 'asc' || s.direction === 'desc')
        ) {
          values[`sort.${sort[1]}`] = `${s.key},${s.direction}`;
        }
      } catch {
        // Unreadable: leave it out.
      }
    }
  }
  return values;
}
