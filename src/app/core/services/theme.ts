import {
  computed,
  effect,
  inject,
  Injectable,
  PLATFORM_ID,
  signal,
  untracked,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { PreferencesService, PreferenceValues } from './preferences';

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
  { id: 'ayu-light', label: 'Ayu Light', mode: 'light' },
  { id: 'catppuccin-latte', label: 'Catppuccin Latte', mode: 'light' },
  { id: 'everforest-light', label: 'Everforest', mode: 'light' },
  { id: 'github-light', label: 'GitHub', mode: 'light' },
  { id: 'gruvbox-light', label: 'Gruvbox', mode: 'light' },
  { id: 'gruvbox-material-light', label: 'Gruvbox Material', mode: 'light' },
  { id: 'material-light', label: 'Material', mode: 'light' },
  { id: 'one-light', label: 'One Light', mode: 'light' },
  { id: 'rose-pine-dawn', label: 'Rosé Pine Dawn', mode: 'light' },
  { id: 'solarized-light', label: 'Solarized', mode: 'light' },
  { id: 'tokyo-night-day', label: 'Tokyo Night Day', mode: 'light' },
  { id: 'homesilo-dark', label: 'HomeSilo', mode: 'dark' },
  { id: 'ayu-dark', label: 'Ayu Dark', mode: 'dark' },
  { id: 'ayu-mirage', label: 'Ayu Mirage', mode: 'dark' },
  { id: 'catppuccin-frappe', label: 'Catppuccin Frappé', mode: 'dark' },
  { id: 'catppuccin-macchiato', label: 'Catppuccin Macchiato', mode: 'dark' },
  { id: 'catppuccin-mocha', label: 'Catppuccin Mocha', mode: 'dark' },
  { id: 'dracula', label: 'Dracula', mode: 'dark' },
  { id: 'everforest', label: 'Everforest', mode: 'dark' },
  { id: 'github-dark', label: 'GitHub', mode: 'dark' },
  { id: 'gruvbox-dark', label: 'Gruvbox', mode: 'dark' },
  { id: 'gruvbox-material-dark', label: 'Gruvbox Material', mode: 'dark' },
  { id: 'gruvbox-material-dark-hard', label: 'Gruvbox Material Hard', mode: 'dark' },
  { id: 'gruvbox-material-dark-soft', label: 'Gruvbox Material Soft', mode: 'dark' },
  { id: 'kanagawa', label: 'Kanagawa', mode: 'dark' },
  { id: 'material-dark', label: 'Material', mode: 'dark' },
  { id: 'monokai', label: 'Monokai', mode: 'dark' },
  { id: 'night-owl', label: 'Night Owl', mode: 'dark' },
  { id: 'nord', label: 'Nord', mode: 'dark' },
  { id: 'one-dark', label: 'One Dark', mode: 'dark' },
  { id: 'rose-pine', label: 'Rosé Pine', mode: 'dark' },
  { id: 'rose-pine-moon', label: 'Rosé Pine Moon', mode: 'dark' },
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

/** An accent colour over the theme's own, or the theme's ('theme'). */
export type Accent =
  | 'theme'
  | 'blue'
  | 'teal'
  | 'green'
  | 'gold'
  | 'orange'
  | 'red'
  | 'pink'
  | 'purple';
export const ACCENTS: readonly { value: Accent; label: string; color: string | null }[] = [
  { value: 'theme', label: "Theme's own", color: null },
  { value: 'blue', label: 'Blue', color: '#3b82f6' },
  { value: 'teal', label: 'Teal', color: '#14b8a6' },
  { value: 'green', label: 'Green', color: '#22c55e' },
  { value: 'gold', label: 'Gold', color: '#f2a628' },
  { value: 'orange', label: 'Orange', color: '#f97316' },
  { value: 'red', label: 'Red', color: '#ef4444' },
  { value: 'pink', label: 'Pink', color: '#ec4899' },
  { value: 'purple', label: 'Purple', color: '#8b5cf6' },
];

/** Vivid cards have colour glows and watermarks; flat ones are plain surfaces. */
export type CardStyle = 'vivid' | 'flat';
export const CARD_STYLES: readonly { value: CardStyle; label: string }[] = [
  { value: 'vivid', label: 'Vivid' },
  { value: 'flat', label: 'Flat' },
];

export type Font = 'inter' | 'system' | 'readable';
export const FONTS: readonly { value: Font; label: string; hint: string }[] = [
  { value: 'inter', label: 'Inter', hint: 'HomeSilo’s font' },
  { value: 'system', label: 'System', hint: 'Your device’s font' },
  { value: 'readable', label: 'Hyperlegible', hint: 'Letters that are hard to confuse' },
];

/** 'system' follows the device's "reduce motion" setting. */
export type Motion = 'system' | 'full' | 'reduced';
export const MOTIONS: readonly { value: Motion; label: string }[] = [
  { value: 'system', label: 'Match device' },
  { value: 'full', label: 'Full' },
  { value: 'reduced', label: 'Reduced' },
];

const DEFAULT_THEME: Record<Theme, string> = {
  light: 'homesilo-light',
  dark: 'homesilo-dark',
};

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private platformId = inject(PLATFORM_ID);
  private prefs = inject(PreferencesService);
  /**
   * This browser's copy of the last look shown, used before anyone signs in
   * (the sign-in page, and the first moment of a visit). The signed-in
   * account's own settings come from {@link PreferencesService}.
   */
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

  readonly accent = signal<Accent>(
    this.storedChoice(
      'accent',
      ACCENTS.map((a) => a.value),
      'theme',
    ),
  );
  readonly cards = signal<CardStyle>(
    this.storedChoice(
      'cards',
      CARD_STYLES.map((c) => c.value),
      'vivid',
    ),
  );
  readonly font = signal<Font>(
    this.storedChoice(
      'font',
      FONTS.map((f) => f.value),
      'inter',
    ),
  );
  readonly motion = signal<Motion>(
    this.storedChoice(
      'motion',
      MOTIONS.map((m) => m.value),
      'system',
    ),
  );
  private readonly systemReducedMotion = signal(
    isPlatformBrowser(this.platformId) &&
      !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
  );
  /** Whether animations are cut down, by this setting or the device's. */
  readonly reducedMotion = computed(() =>
    this.motion() === 'system' ? this.systemReducedMotion() : this.motion() === 'reduced',
  );

  /** The spacing as a factor of the default; matches --space-scale in styles.css. */
  readonly spaceScale = computed(
    () => ({ compact: 0.55, comfortable: 1, spacious: 1.6 })[this.spacing()],
  );

  /** The theme showing right now. */
  readonly active = computed<ThemeDefinition>(() => definition(this.chosen()[this.theme()]));

  constructor() {
    // Another account's settings, or a fresh copy from the server: show them.
    effect(() => {
      // Only on a switch, not on every change (whatever made a change already shows it,
      // and signing out clears the values but keeps the look on screen).
      if (this.prefs.revision() === 0) return; // nobody signed in yet: keep this browser's look
      untracked(() => this.applyPreferences(this.prefs.values()));
    });

    this.media?.addEventListener?.('change', (e) =>
      this.systemTheme.set(e.matches ? 'light' : 'dark'),
    );
    if (isPlatformBrowser(this.platformId)) {
      window
        .matchMedia?.('(prefers-reduced-motion: reduce)')
        ?.addEventListener?.('change', (e) => this.systemReducedMotion.set(e.matches));
    }

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
      root.setAttribute('data-cards', this.cards());
      root.setAttribute('data-font', this.font());
      root.setAttribute('data-motion', this.reducedMotion() ? 'reduced' : 'full');
      this.applyAccent(root, theme);
      // The browser's own chrome (mobile address bar) matches the app's shell.
      // (Read after the accent is applied, which can't change the shell colour.)
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

  setAccent(accent: Accent): void {
    this.accent.set(accent);
    this.write('hs-accent', accent);
    this.prefs.set({ 'appearance.accent': accent === 'theme' ? null : accent });
  }

  setCards(cards: CardStyle): void {
    this.cards.set(cards);
    this.write('hs-cards', cards);
    this.prefs.set({ 'appearance.cards': cards === 'vivid' ? null : cards });
  }

  setFont(font: Font): void {
    this.font.set(font);
    this.write('hs-font', font);
    this.prefs.set({ 'appearance.font': font === 'inter' ? null : font });
  }

  setMotion(motion: Motion): void {
    this.motion.set(motion);
    this.write('hs-motion', motion);
    this.prefs.set({ 'appearance.motion': motion === 'system' ? null : motion });
  }

  /** Back to HomeSilo's look: themes, mode and every appearance setting. */
  resetAppearance(): void {
    this.preference.set('system');
    this.chosen.set({ ...DEFAULT_THEME });
    this.saveThemes();
    this.setCorners('rounded');
    this.setSpacing('comfortable');
    this.setAccent('theme');
    this.setCards('vivid');
    this.setFont('inter');
    this.setMotion('system');
  }

  /** True when everything is as HomeSilo ships it. */
  readonly isDefaultAppearance = computed(
    () =>
      this.preference() === 'system' &&
      this.chosen().light === DEFAULT_THEME.light &&
      this.chosen().dark === DEFAULT_THEME.dark &&
      this.corners() === 'rounded' &&
      this.spacing() === 'comfortable' &&
      this.accent() === 'theme' &&
      this.cards() === 'vivid' &&
      this.font() === 'inter' &&
      this.motion() === 'system',
  );

  /**
   * An accent colour over the theme: the accent itself, a hover shade, a shade
   * that reads as text on this mode's background, and black or white text on it,
   * whichever contrasts more. Tints follow from the accent in themes.css.
   */
  private applyAccent(root: HTMLElement, mode: Theme): void {
    const color = ACCENTS.find((a) => a.value === this.accent())?.color;
    const props = [
      '--color-accent',
      '--color-accent-hover',
      '--color-accent-text',
      '--color-text-on-accent',
    ];
    if (!color) {
      root.removeAttribute('data-accent');
      props.forEach((p) => root.style.removeProperty(p));
      return;
    }
    root.setAttribute('data-accent', this.accent());
    root.style.setProperty('--color-accent', color);
    root.style.setProperty(
      '--color-accent-hover',
      `color-mix(in srgb, ${color} 85%, ${mode === 'dark' ? 'white' : 'black'})`,
    );
    root.style.setProperty(
      '--color-accent-text',
      mode === 'dark'
        ? `color-mix(in srgb, ${color} 80%, white)`
        : `color-mix(in srgb, ${color} 68%, black)`,
    );
    root.style.setProperty('--color-text-on-accent', readableOn(color));
  }

  setCorners(corners: Corners): void {
    this.corners.set(corners);
    this.write('hs-corners', corners);
    this.prefs.set({ 'appearance.corners': corners === 'rounded' ? null : corners });
  }

  setSpacing(spacing: Spacing): void {
    this.spacing.set(spacing);
    this.write('hs-spacing', spacing);
    this.prefs.set({ 'appearance.spacing': spacing === 'comfortable' ? null : spacing });
  }

  setPreference(preference: ThemePreference): void {
    this.preference.set(preference);
    this.saveThemes();
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
    this.saveThemes();
  }

  isChosen(id: string): boolean {
    const theme = THEMES.find((t) => t.id === id);
    return !!theme && this.chosen()[theme.mode] === id;
  }

  toggle(): void {
    this.setPreference(this.theme() === 'dark' ? 'light' : 'dark');
  }

  /** The mode and the theme for each, as account settings (defaults left out). */
  private saveThemes(): void {
    const pref = this.preference();
    const chosen = this.chosen();
    this.prefs.set({
      'theme.mode': pref === 'system' ? null : pref,
      'theme.light': chosen.light === DEFAULT_THEME.light ? null : chosen.light,
      'theme.dark': chosen.dark === DEFAULT_THEME.dark ? null : chosen.dark,
    });
  }

  /** Shows an account's settings; anything it hasn't set gets its default. */
  private applyPreferences(values: PreferenceValues): void {
    const mode = values['theme.mode'];
    this.preference.set(mode === 'light' || mode === 'dark' ? mode : 'system');
    const themeFor = (m: Theme) => {
      const id = values[`theme.${m}`];
      return THEMES.some((t) => t.id === id && t.mode === m) ? id! : DEFAULT_THEME[m];
    };
    this.chosen.set({ light: themeFor('light'), dark: themeFor('dark') });

    const pick = <T extends string>(name: string, allowed: readonly T[], fallback: T): T => {
      const value = values[`appearance.${name}`] as T | undefined;
      const chosen = value && allowed.includes(value) ? value : fallback;
      this.write(`hs-${name}`, chosen); // this browser's last look, for the sign-in page
      return chosen;
    };
    this.corners.set(
      pick(
        'corners',
        CORNERS.map((c) => c.value),
        'rounded',
      ),
    );
    this.spacing.set(
      pick(
        'spacing',
        SPACING.map((c) => c.value),
        'comfortable',
      ),
    );
    this.accent.set(
      pick(
        'accent',
        ACCENTS.map((a) => a.value),
        'theme',
      ),
    );
    this.cards.set(
      pick(
        'cards',
        CARD_STYLES.map((c) => c.value),
        'vivid',
      ),
    );
    this.font.set(
      pick(
        'font',
        FONTS.map((f) => f.value),
        'inter',
      ),
    );
    this.motion.set(
      pick(
        'motion',
        MOTIONS.map((m) => m.value),
        'system',
      ),
    );
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

/** Black or white, whichever reads better on this colour (WCAG relative luminance). */
export function readableOn(hex: string): string {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(0) + 0.7152 * channel(1) + 0.0722 * channel(2);
  // Contrast with black is (L + 0.05) / 0.05, with white 1.05 / (L + 0.05).
  return (luminance + 0.05) / 0.05 >= 1.05 / (luminance + 0.05) ? '#111318' : '#ffffff';
}
