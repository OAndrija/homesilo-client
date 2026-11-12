import { TestBed } from '@angular/core/testing';
import { readableOn, THEMES, ThemeService } from './theme';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('follows the system setting until the user picks a theme', () => {
    const service = TestBed.inject(ThemeService);
    expect(service.preference()).toBe('system');
    // jsdom has no colour-scheme preference, so "system" resolves to dark.
    expect(service.theme()).toBe('dark');
  });

  it('applies and remembers an explicit choice', () => {
    const service = TestBed.inject(ThemeService);
    service.setPreference('light');
    TestBed.tick();
    expect(service.theme()).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem('hs-theme')).toBe('light');
  });

  it('restores a saved preference, including "system"', () => {
    localStorage.setItem('hs-theme', 'system');
    expect(TestBed.inject(ThemeService).preference()).toBe('system');
  });

  it('toggle switches between light and dark from whatever is showing', () => {
    const service = TestBed.inject(ThemeService);
    service.toggle();
    expect(service.preference()).toBe('light');
    service.toggle();
    expect(service.preference()).toBe('dark');
  });
});

describe('ThemeService themes', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    document.documentElement.removeAttribute('data-palette');
  });

  it('starts with the HomeSilo theme for each mode', () => {
    const service = TestBed.inject(ThemeService);
    expect(service.chosen()).toEqual({ light: 'homesilo-light', dark: 'homesilo-dark' });
    TestBed.tick();
    expect(document.documentElement.getAttribute('data-palette')).toBe('homesilo-dark');
  });

  it('picking a theme switches to its mode and remembers it', () => {
    const service = TestBed.inject(ThemeService);
    service.setPreference('light');
    service.setTheme('nord');
    TestBed.tick();
    expect(service.preference()).toBe('dark');
    expect(service.active().id).toBe('nord');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.getAttribute('data-palette')).toBe('nord');
    expect(localStorage.getItem('hs-theme-dark')).toBe('nord');
    expect(service.isChosen('nord')).toBe(true);
  });

  it('keeps following the system when a theme is picked', () => {
    const service = TestBed.inject(ThemeService);
    service.setTheme('github-light');
    expect(service.preference()).toBe('system');
    expect(service.chosen().light).toBe('github-light');
    // jsdom resolves "system" to dark, so the dark theme still shows.
    expect(service.active().id).toBe('homesilo-dark');
  });

  it('has unique theme ids, starting each mode with HomeSilo', () => {
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(THEMES.length);
    const service = TestBed.inject(ThemeService);
    expect(service.lightThemes[0].id).toBe('homesilo-light');
    expect(service.darkThemes[0].id).toBe('homesilo-dark');
  });

  it('ignores unknown or mismatched saved themes', () => {
    localStorage.setItem('hs-theme-light', 'dracula');
    localStorage.setItem('hs-theme-dark', 'no-such-theme');
    const service = TestBed.inject(ThemeService);
    expect(service.chosen()).toEqual({ light: 'homesilo-light', dark: 'homesilo-dark' });
  });
});

describe('ThemeService corners and spacing', () => {
  beforeEach(() => localStorage.clear());

  it('defaults to rounded corners and comfortable spacing', () => {
    const service = TestBed.inject(ThemeService);
    TestBed.tick();
    expect(service.corners()).toBe('rounded');
    expect(document.documentElement.getAttribute('data-corners')).toBe('rounded');
    expect(document.documentElement.getAttribute('data-spacing')).toBe('comfortable');
  });

  it('applies and saves a choice at once', () => {
    const service = TestBed.inject(ThemeService);
    service.setCorners('sharp');
    service.setSpacing('spacious');
    expect(localStorage.getItem('hs-corners')).toBe('sharp');
    expect(localStorage.getItem('hs-spacing')).toBe('spacious');
    TestBed.tick();
    expect(document.documentElement.getAttribute('data-corners')).toBe('sharp');
    expect(document.documentElement.getAttribute('data-spacing')).toBe('spacious');
  });

  it('ignores unknown saved values', () => {
    localStorage.setItem('hs-corners', 'wobbly');
    expect(TestBed.inject(ThemeService).corners()).toBe('rounded');
  });
});

describe('ThemeService accent, cards, font and motion', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('style');
  });

  it("uses the theme's own accent until another is picked", () => {
    const service = TestBed.inject(ThemeService);
    TestBed.tick();
    expect(document.documentElement.hasAttribute('data-accent')).toBe(false);
    service.setAccent('teal');
    TestBed.tick();
    const root = document.documentElement;
    expect(root.getAttribute('data-accent')).toBe('teal');
    expect(root.style.getPropertyValue('--color-accent')).toBe('#14b8a6');
    expect(localStorage.getItem('hs-accent')).toBe('teal');
    service.setAccent('theme');
    TestBed.tick();
    expect(root.hasAttribute('data-accent')).toBe(false);
    expect(root.style.getPropertyValue('--color-accent')).toBe('');
  });

  it('marks cards, font and motion on the page', () => {
    const service = TestBed.inject(ThemeService);
    service.setCards('flat');
    service.setFont('readable');
    service.setMotion('reduced');
    TestBed.tick();
    const root = document.documentElement;
    expect(root.getAttribute('data-cards')).toBe('flat');
    expect(root.getAttribute('data-font')).toBe('readable');
    expect(root.getAttribute('data-motion')).toBe('reduced');
    expect(service.reducedMotion()).toBe(true);
  });

  it('resets everything to how HomeSilo comes', () => {
    const service = TestBed.inject(ThemeService);
    service.setTheme('nord');
    service.setAccent('pink');
    service.setCorners('sharp');
    expect(service.isDefaultAppearance()).toBe(false);
    service.resetAppearance();
    expect(service.isDefaultAppearance()).toBe(true);
    expect(localStorage.getItem('hs-accent')).toBe('theme');
  });
});

describe('readableOn', () => {
  it('picks the text colour that contrasts more', () => {
    expect(readableOn('#f2a628')).toBe('#111318');
    expect(readableOn('#22c55e')).toBe('#111318');
    // Dark text on this blue is 5.7:1, white only 3.7:1.
    expect(readableOn('#3b82f6')).toBe('#111318');
    expect(readableOn('#1d4ed8')).toBe('#ffffff');
    expect(readableOn('#b91c1c')).toBe('#ffffff');
  });
});
