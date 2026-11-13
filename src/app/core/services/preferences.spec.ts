import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PreferencesService } from './preferences';

const URL = '/api/v1/users/me/preferences';

describe('PreferencesService', () => {
  let prefs: PreferencesService;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    prefs = TestBed.inject(PreferencesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function signIn(userId: string, values: Record<string, string> = {}): void {
    prefs.load(userId).subscribe();
    http.expectOne(URL).flush({ values, updatedAt: null });
  }

  it("shows this browser's copy for the account at once, then the server's", () => {
    localStorage.setItem('hs-prefs-ana', JSON.stringify({ 'appearance.spacing': 'compact' }));
    localStorage.setItem('hs-prefs-claimed', '1');
    prefs.load('ana').subscribe();
    expect(prefs.get('appearance.spacing')).toBe('compact');

    http.expectOne(URL).flush({ values: { 'appearance.spacing': 'spacious' }, updatedAt: null });
    expect(prefs.get('appearance.spacing')).toBe('spacious');
    expect(JSON.parse(localStorage.getItem('hs-prefs-ana')!)).toEqual({
      'appearance.spacing': 'spacious',
    });
  });

  it("never shows one account's settings to another", () => {
    localStorage.setItem('hs-prefs-claimed', '1');
    signIn('ana', { 'appearance.spacing': 'compact' });
    prefs.clear();
    expect(prefs.get('appearance.spacing')).toBeNull();

    prefs.load('ben').subscribe();
    expect(prefs.get('appearance.spacing')).toBeNull();
    http.expectOne(URL).flush({ values: {}, updatedAt: null });
    expect(prefs.get('appearance.spacing')).toBeNull();
  });

  it('sends only what changed, with null for a default', () => {
    localStorage.setItem('hs-prefs-claimed', '1');
    signIn('ana', { 'appearance.font': 'readable' });

    prefs.set({ 'appearance.font': null, 'theme.mode': 'dark', 'view.trash': null });
    const req = http.expectOne((r) => r.method === 'PATCH' && r.url === URL);
    expect(req.request.body).toEqual({ values: { 'appearance.font': null, 'theme.mode': 'dark' } });
    req.flush({ values: { 'theme.mode': 'dark' }, updatedAt: null });

    expect(prefs.values()).toEqual({ 'theme.mode': 'dark' });
    // Setting what's already there sends nothing.
    prefs.set({ 'theme.mode': 'dark' });
  });

  it('sends changes one after another, in order', () => {
    localStorage.setItem('hs-prefs-claimed', '1');
    signIn('ana');
    prefs.set({ 'appearance.spacing': 'compact' });
    prefs.set({ 'appearance.spacing': 'spacious' });

    const first = http.expectOne((r) => r.method === 'PATCH');
    expect(first.request.body.values['appearance.spacing']).toBe('compact');
    first.flush({ values: {}, updatedAt: null });
    const second = http.expectOne((r) => r.method === 'PATCH');
    expect(second.request.body.values['appearance.spacing']).toBe('spacious');
    second.flush({ values: {}, updatedAt: null });
  });

  it('keeps a change here even if the server fails to save it', () => {
    localStorage.setItem('hs-prefs-claimed', '1');
    signIn('ana');
    prefs.set({ 'appearance.cards': 'flat' });
    http
      .expectOne((r) => r.method === 'PATCH')
      .flush(null, { status: 500, statusText: 'Server Error' });
    expect(prefs.get('appearance.cards')).toBe('flat');
  });

  it("gives this browser's old settings to the first account only", () => {
    localStorage.setItem('hs-theme', 'dark');
    localStorage.setItem('hs-spacing', 'compact');
    localStorage.setItem('hs-corners', 'rounded'); // the default: not carried over
    localStorage.setItem('hs-view-starred', 'grid');
    localStorage.setItem('hs-sort-trash', JSON.stringify({ key: 'name', direction: 'asc' }));

    signIn('ana');
    expect(prefs.values()).toEqual({
      'theme.mode': 'dark',
      'appearance.spacing': 'compact',
      'view.starred': 'grid',
      'sort.trash': 'name,asc',
    });
    const save = http.expectOne((r) => r.method === 'PATCH');
    expect(save.request.body.values).toEqual(prefs.values());
    save.flush({ values: prefs.values(), updatedAt: null });
    expect(localStorage.getItem('hs-view-starred')).toBeNull();

    prefs.clear();
    signIn('ben');
    expect(prefs.values()).toEqual({});
  });

  it("doesn't overwrite an account's saved settings with this browser's old ones", () => {
    localStorage.setItem('hs-spacing', 'compact');
    signIn('ana', { 'appearance.spacing': 'spacious' });
    expect(prefs.get('appearance.spacing')).toBe('spacious');

    // And the old settings are spent: the next new account doesn't get them either.
    prefs.clear();
    signIn('ben');
    expect(prefs.values()).toEqual({});
  });

  it('carries on with the copy here when the server is unreachable', () => {
    localStorage.setItem('hs-prefs-ana', JSON.stringify({ 'appearance.font': 'system' }));
    let done = false;
    prefs.load('ana').subscribe({ complete: () => (done = true) });
    http.expectOne(URL).flush(null, { status: 503, statusText: 'Unavailable' });
    expect(done).toBe(true);
    expect(prefs.get('appearance.font')).toBe('system');
  });
});
