import { computed, effect, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

/** Light or dark: decides which of the two chosen themes is showing. */
export type Theme = 'dark' | 'light';
/** What the user picked; 'system' follows the operating system's setting. */
export type ThemePreference = Theme | 'system';

export interface ThemeDefinition {
  id: string;
  label: string;
  mode: Theme;
}

/**
 * Every colour theme. Each is a set of colour tokens in styles.css, applied with
 * data-palette on <html> next to data-theme (the mode), so styles written for
 * light or dark mode keep working whichever theme is chosen.
 */
export const THEMES: readonly ThemeDefinition[] = [
  { id: 'homesilo-light', label: 'HomeSilo', mode: 'light' },
  { id: 'catppuccin-latte', label: 'Catppuccin Latte', mode: 'light' },
  { id: 'github-light', label: 'GitHub', mode: 'light' },
  { id: 'gruvbox-light', label: 'Gruvbox', mode: 'light' },
  { id: 'material-light', label: 'Material', mode: 'light' },
  { id: 'one-light', label: 'One Light', mode: 'light' },
  { id: 'rose-pine-dawn', label: 'Rosé Pine Dawn', mode: 'light' },
  { id: 'solarized-light', label: 'Solarized', mode: 'light' },
  { id: 'homesilo-dark', label: 'HomeSilo', mode: 'dark' },
  { id: 'catppuccin-mocha', label: 'Catppuccin Mocha', mode: 'dark' },
  { id: 'dracula', label: 'Dracula', mode: 'dark' },
  { id: 'everforest', label: 'Everforest', mode: 'dark' },
  { id: 'github-dark', label: 'GitHub', mode: 'dark' },
  { id: 'gruvbox-dark', label: 'Gruvbox', mode: 'dark' },
  { id: 'material-dark', label: 'Material', mode: 'dark' },
  { id: 'monokai', label: 'Monokai', mode: 'dark' },
  { id: 'nord', label: 'Nord', mode: 'dark' },
  { id: 'one-dark', label: 'One Dark', mode: 'dark' },
  { id: 'rose-pine', label: 'Rosé Pine', mode: 'dark' },
  { id: 'solarized-dark', label: 'Solarized', mode: 'dark' },
  { id: 'tokyo-night', label: 'Tokyo Night', mode: 'dark' },
];

/** How round cards, buttons and fields are. */
export type Corners = 'sharp' | 'subtle' | 'rounded' | 'round';
/** How much room there is between cards and tiles. */
export type Spacing = 'compact' | 'comfortable' | 'spacious';

export const CORNERS: readonly { value: Corners; label: string }[] = [
  { value: 'sharp', label: 'Sharp' },
  { value: 'subtle', label: 'Subtle' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'round', label: 'Extra round' },
];

export const SPACING: readonly { value: Spacing; label: string }[] = [
  { value: 'compact', label: 'Compact' },
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'spacious', label: 'Spacious' },
];

const DEFAULT_THEME: Record<Theme, string> = {
  light: 'homesilo-light',
  dark: 'homesilo-dark',
};

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private platformId = inject(PLATFORM_ID);
  private readonly STORAGE_KEY = 'hs-theme';
  private readonly media = isPlatformBrowser(this.platformId)
    ? window.matchMedia?.('(prefers-color-scheme: light)')
    : undefined;

  private readonly systemTheme = signal<Theme>(this.media?.matches ? 'light' : 'dark');

  readonly themes = THEMES;
  readonly lightThemes = THEMES.filter((t) => t.mode === 'light');
  readonly darkThemes = THEMES.filter((t) => t.mode === 'dark');

  readonly preference = signal<ThemePreference>(this.storedPreference());
  /** The mode actually applied. */
  readonly theme = computed<Theme>(() => {
    const pref = this.preference();
    return pref === 'system' ? this.systemTheme() : pref;
  });

  /** The theme used in each mode. */
  readonly chosen = signal<Record<Theme, string>>({
    light: this.storedTheme('light'),
    dark: this.storedTheme('dark'),
  });

  readonly corners = signal<Corners>(
    this.storedChoice(
      'corners',
      CORNERS.map((c) => c.value),
      'rounded',
    ),
  );
  readonly spacing = signal<Spacing>(
    this.storedChoice(
      'spacing',
      SPACING.map((c) => c.value),
      'comfortable',
    ),
  );

  /** The theme showing right now. */
  readonly active = computed<ThemeDefinition>(() => definition(this.chosen()[this.theme()]));

  constructor() {
    this.media?.addEventListener?.('change', (e) =>
      this.systemTheme.set(e.matches ? 'light' : 'dark'),
    );

    effect(() => {
      const theme = this.theme();
      const palette = this.active().id;
      const pref = this.preference();
      const chosen = this.chosen();
      if (!isPlatformBrowser(this.platformId)) return;

      const root = document.documentElement;
      root.setAttribute('data-theme', theme);
      root.setAttribute('data-palette', palette);
      root.setAttribute('data-corners', this.corners());
      root.setAttribute('data-spacing', this.spacing());
      // The browser's own chrome (mobile address bar) matches the app's shell.
      const shell = getComputedStyle(root).getPropertyValue('--color-bg-elevated').trim();
      if (shell) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', shell);

      try {
        localStorage.setItem(this.STORAGE_KEY, pref);
        localStorage.setItem(`${this.STORAGE_KEY}-light`, chosen.light);
        localStorage.setItem(`${this.STORAGE_KEY}-dark`, chosen.dark);
      } catch {
        // Storage can be unavailable (private mode); the choice then lasts for this visit.
      }
    });
  }

  setCorners(corners: Corners): void {
    this.corners.set(corners);
    this.write('hs-corners', corners);
  }

  setSpacing(spacing: Spacing): void {
    this.spacing.set(spacing);
    this.write('hs-spacing', spacing);
  }

  setPreference(preference: ThemePreference): void {
    this.preference.set(preference);
  }

  /**
   * Uses a theme for its mode. Picking one for the mode that isn't showing switches
   * to that mode, unless the app follows the system, which then decides.
   */
  setTheme(id: string): void {
    const theme = THEMES.find((t) => t.id === id);
    if (!theme) return;
    this.chosen.update((c) => ({ ...c, [theme.mode]: theme.id }));
    if (this.preference() !== 'system') this.preference.set(theme.mode);
  }

  isChosen(id: string): boolean {
    const theme = THEMES.find((t) => t.id === id);
    return !!theme && this.chosen()[theme.mode] === id;
  }

  toggle(): void {
    this.preference.set(this.theme() === 'dark' ? 'light' : 'dark');
  }

  private storedPreference(): ThemePreference {
    const stored = this.read(this.STORAGE_KEY);
    return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
  }

  private storedTheme(mode: Theme): string {
    const stored = this.read(`${this.STORAGE_KEY}-${mode}`);
    return THEMES.some((t) => t.id === stored && t.mode === mode) ? stored! : DEFAULT_THEME[mode];
  }

  private storedChoice<T extends string>(name: string, allowed: readonly T[], fallback: T): T {
    const stored = this.read(`hs-${name}`);
    return allowed.includes(stored as T) ? (stored as T) : fallback;
  }

  /** Saved right away, so a choice survives even if the page closes at once. */
  private write(key: string, value: string): void {
    if (!isPlatformBrowser(this.platformId)) return;
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage can be unavailable (private mode); the choice then lasts for this visit.
    }
  }

  private read(key: string): string | null {
    if (!isPlatformBrowser(this.platformId)) return null;
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
}

function definition(id: string): ThemeDefinition {
  return THEMES.find((t) => t.id === id) ?? THEMES[0];
}
