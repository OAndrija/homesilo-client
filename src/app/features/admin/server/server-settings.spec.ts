import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BackupStatus, ServerSettings } from '../../../core/models/server-settings';
import { ServerSettingsPage } from './server-settings';

const GB = 1024 ** 3;

const SETTINGS: ServerSettings = {
  registrationOpen: false,
  defaultQuotaBytes: 100 * GB,
  trashRetentionDays: 30,
  activityRetentionDays: 90,
  maxUploadBytes: 5 * GB,
};

const BACKUPS: BackupStatus = {
  enabled: true,
  location: '/data/backups',
  schedule: '0 0 2 * * *',
  keep: 7,
  running: false,
  lastAttemptAt: '2026-11-19T02:00:00',
  lastError: null,
  backups: [
    {
      name: 'homesilo-20261119-020000.dump',
      sizeBytes: 2_400_000,
      createdAt: '2026-11-19T02:00:00',
    },
  ],
};

describe('ServerSettingsPage', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function open() {
    const fixture = TestBed.createComponent(ServerSettingsPage);
    http.expectOne('/api/v1/admin/settings').flush(SETTINGS);
    http.expectOne('/api/v1/admin/backups').flush(BACKUPS);
    fixture.detectChanges();
    return { fixture, page: fixture.componentInstance, el: fixture.nativeElement as HTMLElement };
  }

  it('shows the settings and the last backup', () => {
    const { page, el } = open();
    expect(page.quotaGb()).toBe(100);
    expect(page.dirty()).toBe(false);
    expect(el.querySelector<HTMLInputElement>('input[role="switch"]')!.checked).toBe(false);
    expect(el.textContent).toContain('every day at 02:00');
    expect(el.textContent).toContain('the last 7 are kept');
  });

  it('saves only what the form holds, in bytes', () => {
    const { page } = open();
    page.quotaGb.set(50);
    page.trashDays.set(7);
    expect(page.dirty()).toBe(true);
    page.save();
    const req = http.expectOne('/api/v1/admin/settings');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({
      defaultQuotaBytes: 50 * GB,
      trashRetentionDays: 7,
      activityRetentionDays: 90,
    });
    req.flush({ ...SETTINGS, defaultQuotaBytes: 50 * GB, trashRetentionDays: 7 });
    expect(page.dirty()).toBe(false);
    expect(page.savedMessage()?.error).toBe(false);
  });

  it("won't save numbers the server would refuse", () => {
    const { page } = open();
    page.trashDays.set(1.5);
    expect(page.valid()).toBe(false);
    page.trashDays.set(-1);
    expect(page.valid()).toBe(false);
    page.save();
    http.expectNone('/api/v1/admin/settings');
  });

  it('turns sign-up on straight away', () => {
    const { page } = open();
    page.toggleSignUp(true);
    const req = http.expectOne('/api/v1/admin/settings');
    expect(req.request.body).toEqual({ registrationOpen: true });
    req.flush({ ...SETTINGS, registrationOpen: true });
    expect(page.settings()!.registrationOpen).toBe(true);
  });

  it('makes a backup on request and shows a failure', () => {
    const { page, fixture, el } = open();
    page.backUpNow();
    http
      .expectOne((r) => r.method === 'POST' && r.url === '/api/v1/admin/backups')
      .flush({ detail: 'pg_dump: connection refused' }, { status: 500, statusText: 'Error' });
    http
      .expectOne((r) => r.method === 'GET' && r.url === '/api/v1/admin/backups')
      .flush({ ...BACKUPS, lastError: 'pg_dump: connection refused' });
    fixture.detectChanges();
    expect(page.backupMessage()?.error).toBe(true);
    expect(el.textContent).toContain('failed: pg_dump: connection refused');
  });

  it('reads a daily cron in words, anything else as it is', () => {
    const { page } = open();
    expect(page.schedule('0 30 3 * * *')).toBe('every day at 03:30');
    expect(page.schedule('0 0 2 * * SUN')).toBe('on the schedule 0 0 2 * * SUN');
  });
});
